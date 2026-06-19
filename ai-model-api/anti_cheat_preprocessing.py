"""
Preprocessing utilities for the AssaultCube AI Anti-Cheat deployment service.

The functions in this file reproduce the same raw telemetry cleaning, row-level
feature engineering, and window-level behavioral feature extraction used during
training.
"""

from __future__ import annotations

from typing import Iterable, List, Tuple

import numpy as np
import pandas as pd

EXPECTED_RAW_COLUMNS = [
    "timestampSec",
    "isShooting",
    "playerPosX",
    "playerPosY",
    "playerPosZ",
    "aimYawSpeed",
    "aimPitchSpeed",
    "moveSpeed",
    "deltaYaw",
    "deltaPitch",
    "health",
    "weaponId",
    "isOnGround",
    "distanceToNearestEnemy",
]

ENGINEERED_ROW_COLUMNS = [
    "dt",
    "abs_deltaYaw",
    "abs_deltaPitch",
    "abs_aimYawSpeed",
    "abs_aimPitchSpeed",
    "aim_speed_magnitude",
    "delta_aim_magnitude",
    "aim_acceleration",
    "move_acceleration",
    "enemy_detected",
    "shooting_aim_magnitude",
    "shooting_enemy_detected",
    "health_missing_or_dead",
    "aim_to_move_ratio",
    "distance_inverse",
]

CONTINUOUS_BEHAVIOR_COLUMNS = [
    "aimYawSpeed",
    "aimPitchSpeed",
    "moveSpeed",
    "deltaYaw",
    "deltaPitch",
]

PRE_GAME_DISTANCE_THRESHOLD = 9998.0


def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().replace(" ", "_") for c in df.columns]
    return df


def basic_preprocess_raw_for_inference(raw_df: pd.DataFrame, source_file: str = "live_session") -> pd.DataFrame:
    """Clean raw telemetry before feature engineering.

    This inference version does not require labels. It removes non-gameplay
    samples such as distanceToNearestEnemy=9999, converts numeric columns, clips
    impossible values, and preserves meaningful zeros.
    """
    data = clean_column_names(raw_df)

    for col in EXPECTED_RAW_COLUMNS:
        if col not in data.columns:
            data[col] = np.nan

    if "source_file" not in data.columns:
        data["source_file"] = source_file
    if "source_type" not in data.columns:
        data["source_type"] = "live"
    if "label" not in data.columns:
        data["label"] = 0

    data["source_file"] = data["source_file"].astype(str)
    data["source_type"] = data["source_type"].astype(str)

    for col in EXPECTED_RAW_COLUMNS + ["label"]:
        data[col] = pd.to_numeric(data[col], errors="coerce")

    data["label"] = data["label"].fillna(0).astype(int).clip(0, 1)
    data[EXPECTED_RAW_COLUMNS] = data[EXPECTED_RAW_COLUMNS].replace([np.inf, -np.inf], np.nan)

    # Without timestamp, samples cannot be ordered into windows.
    data = data.dropna(subset=["timestampSec"]).copy()

    # Remove duplicated telemetry rows inside the same source.
    data = data.drop_duplicates(subset=["source_file"] + EXPECTED_RAW_COLUMNS).copy()

    # Remove not-started / no valid gameplay-context rows.
    valid_distance = data["distanceToNearestEnemy"].notna() & (
        data["distanceToNearestEnemy"] < PRE_GAME_DISTANCE_THRESHOLD
    )
    data = data.loc[valid_distance].copy()

    # Conservative idle-row removal: do not remove normal zero values such as not shooting.
    if len(data) > 0:
        behavior_zero = data[CONTINUOUS_BEHAVIOR_COLUMNS].fillna(0).abs().sum(axis=1) == 0
        no_action = pd.to_numeric(data["isShooting"], errors="coerce").fillna(0) == 0
        dead_or_invalid = pd.to_numeric(data["health"], errors="coerce").fillna(0) <= 0
        clearly_idle = behavior_zero & no_action & dead_or_invalid
        data = data.loc[~clearly_idle].copy()

    if len(data) == 0:
        return data

    data["distanceToNearestEnemy"] = data["distanceToNearestEnemy"].clip(
        lower=0,
        upper=PRE_GAME_DISTANCE_THRESHOLD,
    )
    data["health"] = data["health"].clip(lower=0, upper=100)

    data["isShooting"] = data["isShooting"].fillna(0).round().clip(0, 1).astype(int)
    data["isOnGround"] = data["isOnGround"].fillna(0).round().clip(0, 1).astype(int)

    medians = data[EXPECTED_RAW_COLUMNS].median(numeric_only=True).fillna(0)
    data[EXPECTED_RAW_COLUMNS] = data[EXPECTED_RAW_COLUMNS].fillna(medians)

    for col in ["aimYawSpeed", "aimPitchSpeed", "moveSpeed", "deltaYaw", "deltaPitch"]:
        low, high = data[col].quantile([0.001, 0.999])
        if pd.notna(low) and pd.notna(high) and low < high:
            data[col] = data[col].clip(low, high)

    return data.sort_values(["source_file", "timestampSec"], kind="mergesort").reset_index(drop=True)


def add_engineered_features(data: pd.DataFrame) -> pd.DataFrame:
    data = data.copy()
    if len(data) == 0:
        for col in ENGINEERED_ROW_COLUMNS:
            data[col] = []
        return data

    grouped = data.groupby("source_file", group_keys=False)

    data["dt"] = grouped["timestampSec"].diff().fillna(0.0).clip(lower=1e-3, upper=2.0)
    data["abs_deltaYaw"] = data["deltaYaw"].abs()
    data["abs_deltaPitch"] = data["deltaPitch"].abs()
    data["abs_aimYawSpeed"] = data["aimYawSpeed"].abs()
    data["abs_aimPitchSpeed"] = data["aimPitchSpeed"].abs()

    data["aim_speed_magnitude"] = np.sqrt(data["aimYawSpeed"] ** 2 + data["aimPitchSpeed"] ** 2)
    data["delta_aim_magnitude"] = np.sqrt(data["deltaYaw"] ** 2 + data["deltaPitch"] ** 2)

    data["aim_acceleration"] = grouped["aim_speed_magnitude"].diff().fillna(0.0) / data["dt"]
    data["move_acceleration"] = grouped["moveSpeed"].diff().fillna(0.0) / data["dt"]

    data["enemy_detected"] = (data["distanceToNearestEnemy"] < PRE_GAME_DISTANCE_THRESHOLD).astype(int)
    data["shooting_aim_magnitude"] = data["isShooting"] * data["aim_speed_magnitude"]
    data["shooting_enemy_detected"] = data["isShooting"] * data["enemy_detected"]
    data["health_missing_or_dead"] = (data["health"] <= 0).astype(int)
    data["aim_to_move_ratio"] = data["aim_speed_magnitude"] / (data["moveSpeed"].abs() + 1e-3)
    data["distance_inverse"] = 1.0 / (data["distanceToNearestEnemy"] + 1.0)

    for col in ["aim_acceleration", "move_acceleration", "aim_to_move_ratio"]:
        low, high = data[col].quantile([0.001, 0.999])
        if pd.notna(low) and pd.notna(high) and low < high:
            data[col] = data[col].clip(low, high)

    return data


def make_window_features_for_inference(
    engineered_data: pd.DataFrame,
    window_size: int,
    step: int,
) -> pd.DataFrame:
    """Convert cleaned row-level telemetry into window-level behavioral features."""
    if len(engineered_data) == 0:
        return pd.DataFrame()

    base_features = [c for c in EXPECTED_RAW_COLUMNS if c != "timestampSec"]
    feature_cols = base_features + ENGINEERED_ROW_COLUMNS

    rows = []

    for source_file, group in engineered_data.groupby("source_file", sort=False):
        group = group.sort_values("timestampSec").reset_index(drop=True)
        n = len(group)
        if n < window_size:
            continue

        values = group[feature_cols].replace([np.inf, -np.inf], np.nan).values.astype(np.float32)
        timestamps = group["timestampSec"].values.astype(np.float32)

        col_idx = {c: i for i, c in enumerate(feature_cols)}
        is_shooting_idx = col_idx["isShooting"]
        is_on_ground_idx = col_idx["isOnGround"]
        enemy_detected_idx = col_idx["enemy_detected"]
        delta_aim_idx = col_idx["delta_aim_magnitude"]
        move_speed_idx = col_idx["moveSpeed"]
        shooting_aim_idx = col_idx["shooting_aim_magnitude"]
        distance_idx = col_idx["distanceToNearestEnemy"]

        for start in range(0, n - window_size + 1, step):
            end = start + window_size
            w = values[start:end]

            means = np.nanmean(w, axis=0)
            stds = np.nanstd(w, axis=0)
            mins = np.nanmin(w, axis=0)
            maxs = np.nanmax(w, axis=0)

            row = {
                "source_file": source_file,
                "window_start_idx": start,
                "window_end_idx": end - 1,
                "start_time": float(timestamps[start]),
                "end_time": float(timestamps[end - 1]),
                "duration_sec": float(timestamps[end - 1] - timestamps[start]),
            }

            for j, col in enumerate(feature_cols):
                row[f"{col}_mean"] = float(means[j])
                row[f"{col}_std"] = float(stds[j])
                row[f"{col}_min"] = float(mins[j])
                row[f"{col}_max"] = float(maxs[j])

            shooting_values = w[:, is_shooting_idx]
            distance_values = w[:, distance_idx]
            shooting_mask = shooting_values == 1

            row["shooting_rate"] = float(np.nanmean(shooting_values))
            row["ground_rate"] = float(np.nanmean(w[:, is_on_ground_idx]))
            row["enemy_detected_rate"] = float(np.nanmean(w[:, enemy_detected_idx]))
            row["total_aim_change"] = float(np.nansum(w[:, delta_aim_idx]))
            row["total_movement"] = float(np.nansum(w[:, move_speed_idx]))
            row["shots_count"] = float(np.nansum(shooting_values))
            row["aim_change_while_shooting"] = float(np.nansum(w[:, shooting_aim_idx]))
            row["avg_distance_while_shooting"] = (
                float(np.nanmean(distance_values[shooting_mask])) if np.any(shooting_mask) else 0.0
            )

            rows.append(row)

    return pd.DataFrame(rows)


def prepare_features_for_model(
    raw_df: pd.DataFrame,
    feature_columns: List[str],
    window_size: int,
    step: int,
    source_file: str = "live_session",
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Full inference preprocessing pipeline.

    Returns:
        X_df: model-ready feature table aligned with training feature_columns.
        windows_df: window metadata and all extracted window features.
    """
    clean_df = basic_preprocess_raw_for_inference(raw_df, source_file=source_file)
    engineered_df = add_engineered_features(clean_df)
    windows_df = make_window_features_for_inference(engineered_df, window_size=window_size, step=step)

    if windows_df.empty:
        return pd.DataFrame(columns=feature_columns), windows_df

    X_df = windows_df.copy()
    for col in feature_columns:
        if col not in X_df.columns:
            X_df[col] = np.nan

    X_df = X_df[feature_columns].replace([np.inf, -np.inf], np.nan)
    return X_df, windows_df
