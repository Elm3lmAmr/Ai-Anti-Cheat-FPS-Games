"""Test the deployed cloud API with a CSV file.

Usage:
    python examples/test_remote_predict_csv.py https://your-api-domain telemetry.csv YOUR_API_KEY
"""

import sys
import requests

if len(sys.argv) < 3:
    raise SystemExit("Usage: python examples/test_remote_predict_csv.py <API_URL> <CSV_PATH> [API_KEY]")

api_url = sys.argv[1].rstrip("/")
csv_path = sys.argv[2]
api_key = sys.argv[3] if len(sys.argv) >= 4 else ""

headers = {}
if api_key:
    headers["X-API-Key"] = api_key

with open(csv_path, "rb") as f:
    response = requests.post(
        f"{api_url}/predict-csv",
        headers=headers,
        files={"file": f},
        timeout=120,
    )

print("Status code:", response.status_code)
print(response.text)
