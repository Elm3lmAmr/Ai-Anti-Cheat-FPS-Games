"""Reusable prediction wrapper for the AssaultCube AI Anti-Cheat model."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from anti_cheat_preprocessing import prepare_features_for_model


class AntiCheatPredictor:
    """Load the trained model bundle and run session/window predictions."""

    def __init__(self, model_bundle_path: str | Path):
        self.model_bundle_path = Path(model_bundle_path)
        if not self.model_bundle_path.exists():
            raise FileNotFoundError(
                f"Model bundle not found: {self.model_bundle_path}. "
                "Run the final notebook first and copy anti_cheat_model_bundle.joblib into the model folder."
            )

        bundle = joblib.load(self.model_bundle_path)

        # Supports both the new bundle dict and a raw joblib model fallback.
        if isinstance(bundle, dict) and "model" in bundle:
            self.model = bundle["model"]
            self.metadata = bundle.get("metadata", {})
            self.feature_columns = bundle.get("feature_columns") or self.metadata.get("feature_columns")
            self.decision_threshold = float(bundle.get("decision_threshold", self.metadata.get("decision_threshold", 0.5)))
            self.window_size = int(bundle.get("window_size", self.metadata.get("window_size", 30)))
            self.window_step = int(bundle.get("window_step", self.metadata.get("window_step", 10)))
        else:
            self.model = bundle
            self.metadata = {}
            self.feature_columns = None
            self.decision_threshold = 0.5
            self.window_size = 30
            self.window_step = 10

        if not self.feature_columns:
            raise ValueError(
                "Feature columns were not found inside the bundle. "
                "Use the final deployment-ready notebook to export anti_cheat_model_bundle.joblib."
            )

    def _scores(self, X_df: pd.DataFrame) -> np.ndarray:
        """Return continuous detection scores.

        For probabilistic models this is P(cheating). For LinearSVC this may be
        a decision-function score. The saved threshold is used in both cases.
        """
        if hasattr(self.model, "predict_proba"):
            return self.model.predict_proba(X_df)[:, 1]
        if hasattr(self.model, "decision_function"):
            return self.model.decision_function(X_df)
        if hasattr(self.model, "named_steps"):
            final_model = self.model.named_steps.get("model", None)
            if final_model is not None:
                if hasattr(final_model, "predict_proba"):
                    return self.model.predict_proba(X_df)[:, 1]
                if hasattr(final_model, "decision_function"):
                    return self.model.decision_function(X_df)
        return self.model.predict(X_df).astype(float)

    def predict_dataframe(
        self,
        raw_df: pd.DataFrame,
        source_file: str = "live_session",
        session_cheat_ratio_threshold: float = 0.20,
    ) -> Dict[str, Any]:
        """Predict cheating behavior from raw telemetry rows."""
        X_df, windows_df = prepare_features_for_model(
            raw_df=raw_df,
            feature_columns=self.feature_columns,
            window_size=self.window_size,
            step=self.window_step,
            source_file=source_file,
        )

        if X_df.empty:
            return {
                "status": "not_enough_valid_gameplay",
                "message": "No valid gameplay windows were created. Check whether the session has enough rows after removing distanceToNearestEnemy=9999 rows.",
                "window_count": 0,
                "session_label": "Unknown",
                "is_cheating": None,
            }

        scores = self._scores(X_df)
        preds = (scores >= self.decision_threshold).astype(int)

        window_results = []
        for i, (_, row) in enumerate(windows_df.iterrows()):
            window_results.append({
                "window_index": int(i),
                "start_time": float(row.get("start_time", 0.0)),
                "end_time": float(row.get("end_time", 0.0)),
                "score": float(scores[i]),
                "prediction": int(preds[i]),
                "prediction_label": "Cheating" if int(preds[i]) == 1 else "Clean",
            })

        cheat_window_count = int(preds.sum())
        window_count = int(len(preds))
        cheat_window_ratio = float(cheat_window_count / max(1, window_count))
        max_score = float(np.max(scores))
        mean_score = float(np.mean(scores))

        is_cheating = bool(cheat_window_ratio >= session_cheat_ratio_threshold)
        session_label = "Cheating" if is_cheating else "Clean"

        if cheat_window_ratio >= session_cheat_ratio_threshold:
            risk_level = "High"
        elif cheat_window_ratio > 0:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        return {
            "status": "ok",
            "model_name": self.metadata.get("model_name", "unknown"),
            "decision_threshold": float(self.decision_threshold),
            "session_cheat_ratio_threshold": float(session_cheat_ratio_threshold),
            "window_count": window_count,
            "cheating_window_count": cheat_window_count,
            "cheat_window_ratio": cheat_window_ratio,
            "max_score": max_score,
            "mean_score": mean_score,
            "session_label": session_label,
            "is_cheating": is_cheating,
            "risk_level": risk_level,
            "windows": window_results,
        }

    def predict_csv(
        self,
        csv_path: str | Path,
        session_cheat_ratio_threshold: float = 0.20,
    ) -> Dict[str, Any]:
        csv_path = Path(csv_path)
        raw_df = pd.read_csv(csv_path)
        return self.predict_dataframe(
            raw_df,
            source_file=csv_path.name,
            session_cheat_ratio_threshold=session_cheat_ratio_threshold,
        )

    def predict_rows(
        self,
        rows: List[Dict[str, Any]],
        source_file: str = "live_session",
        session_cheat_ratio_threshold: float = 0.20,
    ) -> Dict[str, Any]:
        raw_df = pd.DataFrame(rows)
        return self.predict_dataframe(
            raw_df,
            source_file=source_file,
            session_cheat_ratio_threshold=session_cheat_ratio_threshold,
        )
