"""
Run inference on a single fundus image using the trained checkpoint
downloaded from Kaggle (best_model.pt).

Usage (PowerShell):
    python predict.py --image path\to\image.png --checkpoint best_model.pt
"""

import argparse
import numpy as np
import torch

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


def predict(image_path: str, checkpoint_path: str):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device))
    model.eval()

    img = preprocess_fundus_image(image_path)
    img = img.astype(np.float32) / 255.0
    img = (img - IMAGENET_MEAN) / IMAGENET_STD
    tensor = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).to(device)

    with torch.no_grad():
        raw_score = model(tensor).item()

    stage = int(np.clip(round(raw_score), 0, 4))
    return raw_score, stage, STAGE_NAMES[stage]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--checkpoint", required=True)
    args = parser.parse_args()

    raw_score, stage, stage_name = predict(args.image, args.checkpoint)
    print(f"Raw severity score: {raw_score:.3f}")
    print(f"Predicted stage: {stage} ({stage_name})")
