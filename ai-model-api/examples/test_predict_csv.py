"""Test the anti-cheat API using a CSV file."""

import json
from pathlib import Path

import requests

CSV_PATH = Path(r"A:\GradProj\Ai Model\Our Data New\Hack\your_test_file.csv")
API_URL = "http://127.0.0.1:8000/predict-csv"

with CSV_PATH.open("rb") as f:
    response = requests.post(API_URL, files={"file": (CSV_PATH.name, f, "text/csv")})

print("Status:", response.status_code)
print(json.dumps(response.json(), indent=2))
