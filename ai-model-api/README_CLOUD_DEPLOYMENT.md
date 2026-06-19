# AI-Powered Anti-Cheat Cloud Deployment Package

This package deploys your trained AssaultCube anti-cheat model as a remote FastAPI service.
Your desktop application should call this API using HTTPS instead of running the model locally.

## 1. Required model file

After running the final training notebook, copy this file:

```text
anti_cheat_outputs/anti_cheat_model_bundle.joblib
```

into:

```text
anti_cheat_cloud_deployment_package/model/anti_cheat_model_bundle.joblib
```

Final structure:

```text
anti_cheat_cloud_deployment_package/
├── api_server.py
├── anti_cheat_predictor.py
├── anti_cheat_preprocessing.py
├── requirements.txt
├── Dockerfile
├── Procfile
├── render.yaml
└── model/
    └── anti_cheat_model_bundle.joblib
```

## 2. Local test before cloud upload

From inside the package folder:

```bash
python -m pip install -r requirements.txt
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000/health
```

Expected status:

```json
{"status": "ok"}
```

## 3. Deploy to a cloud server

Use any platform that can run a Python/FastAPI app or Docker container.
Examples: Render, Railway, Fly.io, Azure App Service, Google Cloud Run, AWS Elastic Beanstalk, or a normal VPS.

Recommended simple route for a graduation project:

1. Put this package in a GitHub repository.
2. Make sure `model/anti_cheat_model_bundle.joblib` exists.
3. Create a new web service from the repository.
4. Use the start command:

```bash
uvicorn api_server:app --host 0.0.0.0 --port $PORT
```

5. Add an environment variable:

```text
ANTI_CHEAT_API_KEY=<choose-a-secret-key>
```

6. After deployment, test:

```text
https://your-api-domain/health
```

## 4. API endpoints

### Health check

```http
GET /health
```

### Predict from CSV

```http
POST /predict-csv
Header: X-API-Key: <your key>
Form-data:
  file: telemetry_session.csv
```

### Predict from JSON rows

```http
POST /predict-json
Header: X-API-Key: <your key>
Content-Type: application/json

{
  "source_file": "live_session",
  "session_cheat_ratio_threshold": 0.20,
  "rows": [
    {"time": 1.0, "distanceToNearestEnemy": 120.0, "deltaYaw": 0.2}
  ]
}
```

## 5. Example response

```json
{
  "status": "ok",
  "model_name": "XGBoost",
  "window_count": 100,
  "cheating_window_count": 31,
  "cheat_window_ratio": 0.31,
  "session_label": "Cheating",
  "is_cheating": true,
  "risk_level": "High"
}
```

## 6. Desktop app integration

The desktop app should not load the ML model. It should only:

1. Collect telemetry rows from the game/session.
2. Send the telemetry to the cloud API.
3. Receive the prediction response.
4. Show the result in the application UI.

Use these fields in the UI:

```text
session_label
is_cheating
risk_level
cheat_window_ratio
max_score
mean_score
```

## 7. Security notes

For the graduation project, an API key is enough for a demo. For production, use:

- HTTPS only.
- API key or JWT authentication.
- Rate limiting.
- Request size limits.
- Logging without storing sensitive player data unnecessarily.
- Model versioning.
