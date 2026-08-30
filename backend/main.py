"""
DR Diagnosis API — integrates the trained ResNet50 ordinal-regression model
(backend branch) with the Next.js frontend (frontend-base-setup branch).

Endpoint contract matches what src/app/page.tsx already calls:
    POST /predict   (multipart/form-data, field name "file")
    -> { continuous_score, clamped_score, integer_stage, stage_label,
         val_mse_loss, peak_qwk, gradcam_base64 }

Run:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import io
from typing import Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import build_model
from preprocessing import (
    apply_clahe,
    isolate_green_channel,
    mask_background,
    median_filter,
    resize_and_stack,
)

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="DR Diagnosis API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model: load once at startup, reuse for every request ───────────────────

def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


DEVICE = get_device()
_model = build_model(DEVICE)
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best_model.pt")
_model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
_model.eval()

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

STAGE_NAMES = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}

# From README.md (backend branch): best validation QWK from the Kaggle training
# run, measured on ~550 held-out images.
PEAK_QWK = 0.8613

# NOTE: val_mse_loss was never logged/saved during training (only QWK was
# tracked in README.md / evaluate_samples.py). This is a placeholder so the
# frontend's existing schema doesn't break — replace with a real number if
# you re-run evaluation and capture MSE, or drop the field from both sides.
VAL_MSE_LOSS_PLACEHOLDER = None


# ── Response schema (field names must match src/app/page.tsx exactly) ──────

class DiagnosisResponse(BaseModel):
    continuous_score: float
    clamped_score: float
    integer_stage: int
    stage_label: str
    val_mse_loss: Optional[float]
    peak_qwk: float
    gradcam_base64: str


# ── Inference helpers ────────────────────────────────────────────────────────

def preprocess_bytes(image_bytes: bytes, size: int = 224) -> np.ndarray:
    """Same pipeline as preprocessing.preprocess_fundus_image, but decodes
    from in-memory bytes (from the upload) instead of reading a file path."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image — is it a valid PNG/JPEG?")

    img = mask_background(img)
    green = isolate_green_channel(img)
    denoised = median_filter(green, ksize=3)
    enhanced = apply_clahe(denoised, clip_limit=2.0, tile_grid_size=(8, 8))
    return resize_and_stack(enhanced, size=size)


def run_inference(image_bytes: bytes) -> dict:
    image = preprocess_bytes(image_bytes)
    image = image.astype(np.float32) / 255.0
    image = (image - IMAGENET_MEAN) / IMAGENET_STD

    tensor = torch.from_numpy(image.transpose(2, 0, 1)).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        raw_score = _model(tensor).item()

    clamped = float(np.clip(raw_score, 0.0, 4.0))
    stage = int(np.clip(round(raw_score), 0, 4))

    return {
        "continuous_score": float(raw_score),
        "clamped_score": clamped,
        "integer_stage": stage,
        "stage_label": STAGE_NAMES[stage],
        "val_mse_loss": VAL_MSE_LOSS_PLACEHOLDER,
        "peak_qwk": PEAK_QWK,
        "gradcam_base64": "",  # not implemented yet
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "Backend is up", "device": str(DEVICE)}


@app.post("/predict", response_model=DiagnosisResponse)
@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def diagnose(file: UploadFile = File(...)):
    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file upload.")

    try:
        result = run_inference(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

    return DiagnosisResponse(**result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
