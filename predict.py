"""
Inference engine for Diabetic Retinopathy prediction.
Supports single forward pass, Test-Time Augmentation (TTA), and MC Dropout Uncertainty estimation.

Usage:
    python predict.py --image path/to/image.png --checkpoint best_model.pt --tta --mc_samples 10
"""

import argparse
import numpy as np
import torch
import torchvision.transforms.functional as TF

from preprocessing import preprocess_fundus_image
from model import build_model

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

STAGE_NAMES = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}


def load_tensor(image_path: str, device: torch.device) -> torch.Tensor:
    img = preprocess_fundus_image(image_path)
    img = img.astype(np.float32) / 255.0
    img = (img - IMAGENET_MEAN) / IMAGENET_STD
    return torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).to(device)


def predict(image_path: str, checkpoint_path: str, use_tta: bool = True, mc_samples: int = 10):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.eval()

    tensor = load_tensor(image_path, device)

    # 1. Base / TTA Prediction
    with torch.no_grad():
        if use_tta:
            preds = [
                model(tensor).item(),
                model(TF.hflip(tensor)).item(),
                model(TF.vflip(tensor)).item(),
                model(torch.rot90(tensor, 1, [2, 3])).item()
            ]
            raw_score = float(np.mean(preds))
        else:
            raw_score = model(tensor).item()

    # 2. Monte Carlo Uncertainty Estimation
    mc_preds = []
    with torch.no_grad():
        for _ in range(mc_samples):
            mc_preds.append(model(tensor, mc_dropout=True).item())
    
    uncertainty = float(np.std(mc_preds))
    stage = int(np.clip(round(raw_score), 0, 4))
    return raw_score, stage, STAGE_NAMES[stage], uncertainty


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to fundus image")
    parser.add_argument("--checkpoint", default="best_model.pt", help="Path to weights file")
    parser.add_argument("--tta", action="store_true", help="Enable Test-Time Augmentation")
    parser.add_argument("--mc_samples", type=int, default=10, help="Number of MC Dropout iterations")
    args = parser.parse_args()

    raw_score, stage, stage_name, uncertainty = predict(
        args.image, args.checkpoint, use_tta=args.tta, mc_samples=args.mc_samples
    )

    print(f"Raw severity score : {raw_score:.3f}")
    print(f"Predicted stage    : {stage} ({stage_name})")
    print(f"Model Uncertainty  : ±{uncertainty:.3f} std dev")
    if uncertainty > 0.40:
        print("⚠️ Warning: High uncertainty detected. Recommend clinician secondary review.")