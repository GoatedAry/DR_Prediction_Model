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
