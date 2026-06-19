"""Use the model directly in Python without starting the API."""

from pathlib import Path
from anti_cheat_predictor import AntiCheatPredictor

MODEL_PATH = Path("model/anti_cheat_model_bundle.joblib")
CSV_PATH = Path(r"A:\GradProj\Ai Model\Our Data New\Hack\your_test_file.csv")

predictor = AntiCheatPredictor(MODEL_PATH)
result = predictor.predict_csv(CSV_PATH)

print(result["session_label"])
print(result["risk_level"])
print(result["cheat_window_ratio"])
