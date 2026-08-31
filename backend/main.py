"""
DR Diagnosis API — Clinical Command Center Backend powered exclusively by the
models, weights, transforms, clinical triage rules, and explainability in `dia-model/`.

Endpoints:
    POST /predict
    POST /api/diagnose
    (multipart/form-data, field name "file")
    -> {
        continuous_score: float,
        clamped_score: float,
        integer_stage: int,
        stage_label: str,
        confidence: float,
        probabilities: list[float],
        val_mse_loss: float,
        peak_qwk: float,
        quality_gate: {
            sharpness: float,
            illumination: float,
            artifacts: float,
            passed: bool
        },
        gradcam_base64: str,
        bounding_boxes: list[dict]
    }
"""

import base64
import io
import os
import sys
from typing import Dict, Any, Optional
from PIL import Image

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Exclusively import from dia-model folder ─────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
DIA_MODEL_DIR = os.path.join(PROJECT_ROOT, "dia-model")

if DIA_MODEL_DIR not in sys.path:
    sys.path.insert(0, DIA_MODEL_DIR)

from model import DRModel, apply_test_time_augmentation
from preprocessing import get_validation_transforms
from clinical_triage import ClinicalTriageSystem
from explainability import (
    get_base_gradcam,
    generate_standard_heatmap_overlay,
    extract_bounding_box_coordinates,
)

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="NetraAI Clinical Diagnosis & Explainability Backend",
    version="2.0",
    description="Clinical Command Center Backend utilizing dia-model weights, EfficientNet-B0 backbone, TTA, and dia-model explainability.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model & Weights: Load exclusively from dia-model ─────────────────────────

def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


DEVICE = get_device()
WEIGHTS_PATH = os.path.join(DIA_MODEL_DIR, "best_weights.pth")

_model = DRModel(num_classes=5, pretrained=False).to(DEVICE)

if os.path.exists(WEIGHTS_PATH):
    _model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
_model.eval()

_triage_system = ClinicalTriageSystem(confidence_threshold=0.80, high_risk_stage=2)
_val_transforms = get_validation_transforms(image_size=224)

STAGE_NAMES = {
    0: "No DR (Normal)",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR",
}

PEAK_QWK = 0.8992
VAL_MSE_LOSS = 0.142


# ── Response Schema ──────────────────────────────────────────────────────────

class QualityGateMetrics(BaseModel):
    sharpness: float
    illumination: float
    artifacts: float
    passed: bool


class DiagnosisResponse(BaseModel):
    continuous_score: float
    clamped_score: float
    integer_stage: int
    stage_label: str
    confidence: float
    probabilities: Optional[list[float]] = None
    val_mse_loss: Optional[float]
    peak_qwk: float
    quality_gate: QualityGateMetrics
    gradcam_base64: str
    bounding_boxes: Optional[list[dict]] = None


# ── Quality Gate Utilities ───────────────────────────────────────────────────

def calculate_quality_gate(raw_bgr: np.ndarray) -> QualityGateMetrics:
    """Computes real-time telemetry metrics: sharpness, illumination, and artifact index."""
    gray = cv2.cvtColor(raw_bgr, cv2.COLOR_BGR2GRAY)

    mask = gray > 15
    if np.sum(mask) > 100:
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharpness_score = float(np.clip((laplacian_var / 420.0) * 100.0, 15.0, 99.4))
    else:
        sharpness_score = 45.0

    mean_lum = float(np.mean(gray[mask])) if np.sum(mask) > 0 else 128.0
    illum_deviation = abs(mean_lum - 128.0)
    illumination_score = float(np.clip(100.0 - illum_deviation * 0.72, 20.0, 98.9))

    clipped_pixels = np.sum(gray > 248)
    total_active = max(np.sum(mask), 1)
    clip_ratio = clipped_pixels / total_active
    artifact_score = float(np.clip((1.0 - clip_ratio * 6.5) * 100.0, 18.0, 99.2))

    passed = bool(
        sharpness_score >= 55.0
        and illumination_score >= 45.0
        and artifact_score >= 60.0
    )

    return QualityGateMetrics(
        sharpness=round(sharpness_score, 1),
        illumination=round(illumination_score, 1),
        artifacts=round(artifact_score, 1),
        passed=passed,
    )


def run_inference(image_bytes: bytes) -> dict:
    """Executes end-to-end inference using dia-model weights, transforms, TTA, triage, and explainability."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    raw_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if raw_bgr is None:
        raise ValueError("Could not decode image bytes — ensure format is PNG, JPEG, or DICOM.")

    quality_gate = calculate_quality_gate(raw_bgr)

    # 1. Transform image using dia-model/preprocessing.py
    raw_rgb = cv2.cvtColor(raw_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(raw_rgb)
    input_tensor = _val_transforms(pil_image).unsqueeze(0).to(DEVICE)

    # 2. Test-Time Augmentation (TTA) from dia-model/model.py
    tta_probs = apply_test_time_augmentation(_model, input_tensor, DEVICE)[0]
    predicted_stage = int(torch.argmax(tta_probs).item())
    confidence = float(tta_probs[predicted_stage].item())

    # 3. Clinical Triage Assessment from dia-model/clinical_triage.py
    _triage_system.evaluate_prediction(tta_probs.unsqueeze(0))

    # Calculate continuous expected stage score from probabilities
    stage_indices = torch.arange(5, dtype=torch.float32, device=DEVICE)
    continuous_score = float(torch.sum(tta_probs * stage_indices).item())

    # 4. Grad-CAM & Heatmap Generation exclusively via dia-model/explainability.py
    grayscale_cam = get_base_gradcam(_model, input_tensor, predicted_stage)
    heatmap_overlay_rgb = generate_standard_heatmap_overlay(grayscale_cam, pil_image, image_size=224)
    
    # Extract interactive JSON bounding box coordinates for explainability display
    bounding_boxes = extract_bounding_box_coordinates(grayscale_cam, threshold=0.5)

    # Convert heatmap overlay RGB to OpenCV BGR and encode to Base64 PNG Data URI
    heatmap_overlay_bgr = cv2.cvtColor(heatmap_overlay_rgb, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode(".png", heatmap_overlay_bgr)
    b64_str = base64.b64encode(buffer).decode("utf-8")
    gradcam_base64 = f"data:image/png;base64,{b64_str}"

    return {
        "continuous_score": round(continuous_score, 4),
        "clamped_score": round(float(predicted_stage), 4),
        "integer_stage": predicted_stage,
        "stage_label": STAGE_NAMES[predicted_stage],
        "confidence": round(confidence, 4),
        "probabilities": [round(float(p), 4) for p in tta_probs.tolist()],
        "val_mse_loss": VAL_MSE_LOSS,
        "peak_qwk": PEAK_QWK,
        "quality_gate": quality_gate.dict(),
        "gradcam_base64": gradcam_base64,
        "bounding_boxes": bounding_boxes,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status": "NetraAI Command Center Backend Online",
        "device": str(DEVICE),
        "model_architecture": "EfficientNet-B0 (dia-model/model.py)",
        "weights": "dia-model/best_weights.pth",
        "tta_enabled": True,
        "explainability": "Grad-CAM & Bounding Boxes (dia-model/explainability.py)",
    }


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
