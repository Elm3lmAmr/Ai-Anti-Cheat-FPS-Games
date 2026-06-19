"""Cloud FastAPI server for the AssaultCube AI Anti-Cheat model.

This API is intended to run on a remote server/cloud platform.
The desktop application sends telemetry to this API over HTTPS.

Start command used by most cloud platforms:
    uvicorn api_server:app --host 0.0.0.0 --port $PORT

For local testing only:
    uvicorn api_server:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from anti_cheat_predictor import AntiCheatPredictor

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "model" / "anti_cheat_model_bundle.joblib")))
API_KEY = os.getenv("ANTI_CHEAT_API_KEY", "").strip()

app = FastAPI(
    title="AI-Powered Anti-Cheat Cloud API",
    description="Remote inference API for AssaultCube telemetry-based cheat detection.",
    version="1.0.0",
)

# Helpful if your desktop app has an embedded browser/web UI.
# For a native desktop app, CORS usually does not matter.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor: Optional[AntiCheatPredictor] = None
load_error: Optional[str] = None

try:
    predictor = AntiCheatPredictor(MODEL_PATH)
except Exception as exc:  # keep API alive so /health explains the issue
    load_error = str(exc)


class PredictRowsRequest(BaseModel):
    rows: List[Dict[str, Any]] = Field(..., description="Raw telemetry rows from the game/session.")
    source_file: str = "live_session"
    session_cheat_ratio_threshold: float = 0.20


def verify_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """Optional API key protection.

    If the environment variable ANTI_CHEAT_API_KEY is set, clients must send:
        X-API-Key: <your key>
    If ANTI_CHEAT_API_KEY is empty, the API is open.
    """
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


def get_predictor() -> AntiCheatPredictor:
    if predictor is None:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "model_not_loaded",
                "message": load_error or "Unknown model loading error",
                "expected_model_path": str(MODEL_PATH),
            },
        )
    return predictor


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "service": "AI-Powered Anti-Cheat Cloud API",
        "status_endpoint": "/health",
        "documentation": "/docs",
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    if predictor is None:
        return {
            "status": "model_not_loaded",
            "error": load_error,
            "expected_model_path": str(MODEL_PATH),
        }

    return {
        "status": "ok",
        "model_name": predictor.metadata.get("model_name", "unknown"),
        "window_size": predictor.window_size,
        "window_step": predictor.window_step,
        "decision_threshold": predictor.decision_threshold,
        "api_key_enabled": bool(API_KEY),
    }


@app.post("/predict-json")
def predict_json(
    request: PredictRowsRequest,
    _: None = Depends(verify_api_key),
) -> Dict[str, Any]:
    model = get_predictor()
    try:
        return model.predict_rows(
            request.rows,
            source_file=request.source_file,
            session_cheat_ratio_threshold=request.session_cheat_ratio_threshold,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/predict-csv")
async def predict_csv(
    file: UploadFile = File(...),
    session_cheat_ratio_threshold: float = 0.20,
    _: None = Depends(verify_api_key),
) -> Dict[str, Any]:
    model = get_predictor()

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        raw_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            tmp.write(raw_bytes)
            tmp_path = Path(tmp.name)

        try:
            return model.predict_csv(
                tmp_path,
                session_cheat_ratio_threshold=session_cheat_ratio_threshold,
            )
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
