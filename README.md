# Comprehensive Diabetes & Diabetic Retinopathy Diagnostic Platform

This repository integrates multimodal clinical diagnosis, Diabetic Retinopathy (DR) grading, and Glycemic Risk Assessment.

---

## 1. DR Stage-Aware Diagnosis — Ordinal Regression (ResNet50)

Repo: https://github.com/GoatedAry/DR_Prediction_Model

These files match the exact architecture and config used to train `backend/best_model.pt` on Kaggle. **Best validation QWK achieved: 0.8613 (86.13%)** — close to the source paper's reported 0.8992, and well past their stated clinical threshold of 0.8.

### Run inference on a single fundus image

`backend/best_model.pt` is included in the repository.

```bash
python predict.py --image path/to/some_fundus_image.png --checkpoint backend/best_model.pt
```

Output:
```text
Raw severity score: 2.734
Predicted stage: 3 (Severe NPDR)
```

---

## 2. Multimodal AI Diabetes / Glycemic Risk Assessment — CGMacros

Research-grade participant-level classifier (Healthy / Pre-T2D / T2D) built on the CGMacros dataset, following the PRD's core principle: **small, regularized, interpretable models + rigorous participant-level validation**.

### Getting started

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running the API

```bash
uvicorn api.server:app --reload
```

Test against it from a second terminal:
```bash
curl -X POST http://localhost:8000/assess \
  -F "cgm_file=@CGMacros/CGMacros-005/CGMacros-005.csv" \
  -F 'clinical_json={"age":45,"bmi":28.1,"fasting_glucose":98,"gender":"M"}'
```

---

## 3. SIH MedTech ML Service Layer

Standalone ML inference layer for the SIH MedTech backend:
- Diabetic Retinopathy (DR) image inference (`retinopathy/`)
- Diabetes risk prediction interface (`diabetes/`)

Architecture:
```text
Frontend (Next.js)
   |
   v
FastAPI Backend
   |
   +----------------------+
   |                      |
   v                      v
DiabetesPredictor   RetinopathyPredictor
   |                      |
   v                      v
Diabetes Model       DR Model
```

---

## 4. Full-Stack Web Interface (Next.js + WebGL)

The user-facing portal provides biometric particle visualization, interactive fundus scan intake, and full-screen diagnostic staging.

```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`.



---

## 5. System Prerequisites

| Requirement | Version / Notes |
|---|---|
| Python | 3.9+ |
| Node.js | 18+ |
| npm | Bundled with Node.js |
| pip | Latest recommended |
| GPU (CUDA) | Optional — speeds up training/inference; CPU works fine for inference with the included checkpoints |
| OS | Linux, macOS, or Windows (WSL recommended on Windows for the Python side) |

**Key Python dependencies** (see `requirements.txt` for the full, versioned list):
- `torch`, `torchvision`, `opencv-python` — DR model + image preprocessing
- `numpy`, `pandas`, `scipy`, `scikit-learn`, `joblib` — core data science
- `xgboost`, `lightgbm`, `shap` — diabetes/glycemic risk model + explainability
- `groq`, `pydantic` — LLM layer and schema validation
- `fastapi`, `uvicorn`, `python-multipart` — API layer
- `pytest` — test suite

**Key Node dependencies** (see `package.json` for the full list):
- `next`, `react`, `react-dom` — frontend framework
- `three`, `@react-three/fiber`, `@react-three/drei` — WebGL/3D visualization
- `@supabase/supabase-js` — backing data store client

**Environment variables** (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 6. Setup Instructions

### Clone the repository
```bash
git clone https://github.com/GoatedAry/DR_Prediction_Model.git
cd DR_Prediction_Model
```

### Python environment (DR model + diabetes/CGMacros model)
```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run the DR (Diabetic Retinopathy) backend
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
This loads `backend/best_model.pt` at startup and exposes the `/predict` endpoint used by the frontend (see API Documentation below).

### Run the diabetes / CGMacros risk-assessment API
```bash
uvicorn api.server:app --reload
```
This exposes the `/assess` endpoint (see API Documentation below).

> Both APIs run independently on different ports; run whichever service matches the feature you're working on.

### Frontend
```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL/key
npm run dev
```
Navigate to `http://localhost:3000`.

### Command-line inference (no server needed)
```bash
python predict.py --image path/to/some_fundus_image.png --checkpoint backend/best_model.pt
```

### Running tests
```bash
pytest
```

---

## 7. API Documentation

### DR Diagnosis API (`backend/main.py`)

Base URL (local): `http://localhost:8000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check. Returns service status and the compute device (`cpu`/`cuda`) in use. |
| `POST` | `/predict` | Run DR staging inference on a single fundus image. |
| `POST` | `/api/diagnose` | Identical to `/predict` (alias route used by the frontend). |

**`POST /predict`**
- Content type: `multipart/form-data`
- Form field: `file` — a single PNG/JPEG fundus image

Example request:
```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@path/to/some_fundus_image.png"
```

Example response:
```json
{
  "continuous_score": 2.734,
  "clamped_score": 2.734,
  "integer_stage": 3,
  "stage_label": "Severe NPDR",
  "val_mse_loss": null,
  "peak_qwk": 0.8613,
  "gradcam_base64": ""
}
```

Response fields:
| Field | Type | Description |
|---|---|---|
| `continuous_score` | float | Raw ordinal-regression output before clamping |
| `clamped_score` | float | `continuous_score` clamped to the valid `[0, 4]` range |
| `integer_stage` | int | Rounded stage, `0`–`4` |
| `stage_label` | string | Human-readable stage: `No DR`, `Mild NPDR`, `Moderate NPDR`, `Severe NPDR`, `Proliferative DR` |
| `val_mse_loss` | float or `null` | Currently always `null` — MSE was not logged during the original training run |
| `peak_qwk` | float | Best validation Quadratic Weighted Kappa from training (fixed reference value, not computed per-request) |
| `gradcam_base64` | string | Reserved for a Grad-CAM visualization; **not implemented yet**, always returned as an empty string |

Error responses: `400` for an empty/invalid file upload, `500` if inference itself throws.

### Diabetes / Glycemic Risk Screening API (`api/server.py`)

Base URL (local): `http://localhost:8000` (use a different `--port` if running alongside the DR API on the same machine)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check. Returns `{"status": "ok"}`. |
| `POST` | `/assess` | Run glycemic/metabolic risk screening from CGM data + clinical fields. |

**`POST /assess`**
- Content type: `multipart/form-data`
- Form fields:
  - `cgm_file` — a CGMacros-format CSV (`Timestamp`, `Libre GL`, `Dexcom GL`, `HR`, `METs`, `Calories (Activity)`, `Meal Type`, `Carbs`, `Protein`, `Fat`, `Fiber`, ...)
  - `clinical_json` — a JSON string with fields: `age`, `gender`, `bmi`, `fasting_glucose`, `fasting_insulin`, `triglycerides`, `total_cholesterol`, `hdl`, `ldl`, `vldl`, `chol_hdl_ratio`. **Do not include `hba1c`** — the endpoint rejects it with a `400` since it's the training label, not a screening input.

Example request:
```bash
curl -X POST http://localhost:8000/assess \
  -F "cgm_file=@CGMacros/CGMacros-005/CGMacros-005.csv" \
  -F 'clinical_json={"age":45,"bmi":28.1,"fasting_glucose":98,"gender":"M"}'
```

Error responses: `400` if `clinical_json` isn't valid JSON, `400` if `hba1c` is included, `500` if inference throws.

> **Note:** this endpoint performs metabolic **risk screening**, not diagnosis.

### Known limitations of the current API layer

- `api/server.py` has not yet been smoke-tested against a live request in the environment it was authored in; test it locally before relying on it.
- `gradcam_base64` in the DR API is a placeholder and always returns `""`.
- `val_mse_loss` in the DR API is always `null` (MSE was never logged during training, only QWK).