"""
Preprocessing pipeline for Diabetic Retinopathy fundus images.
Implements: Background Masking -> Green Channel Isolation -> Median Filtering
            -> CLAHE -> Resize (224x224) -> 3-channel recreation
Matches the pipeline used in the Kaggle training notebook exactly.
"""

import cv2
import numpy as np


def mask_background(img: np.ndarray, threshold: int = 10) -> np.ndarray:
    """Crop out the black background surrounding the fundus ROI."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    mask = gray > threshold

    if mask.sum() == 0:
        return img

    coords = np.argwhere(mask)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1
    return img[y0:y1, x0:x1]


def isolate_green_channel(img: np.ndarray) -> np.ndarray:
    """Extract the green channel (index 1 in OpenCV's BGR ordering)."""
    return img[:, :, 1]


def median_filter(img: np.ndarray, ksize: int = 3) -> np.ndarray:
    """Remove salt-and-pepper noise while preserving lesion edges."""
    return cv2.medianBlur(img, ksize)


def apply_clahe(img: np.ndarray, clip_limit: float = 2.0, tile_grid_size=(8, 8)) -> np.ndarray:
    """Contrast Limited Adaptive Histogram Equalization on a single channel."""
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(img)


def resize_and_stack(img: np.ndarray, size: int = 224) -> np.ndarray:
    """Resize to size x size and replicate single channel into 3 channels."""
    resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    return cv2.merge([resized, resized, resized])


def preprocess_fundus_image(image_path: str, size: int = 224) -> np.ndarray:
    """Full pipeline. Returns a (size, size, 3) uint8 array ready for the model."""
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    img = mask_background(img)
    green = isolate_green_channel(img)
    denoised = median_filter(green, ksize=3)
    enhanced = apply_clahe(denoised)
    final = resize_and_stack(enhanced, size=size)
    return final


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python preprocessing.py <input_image> <output_image>")
        sys.exit(1)
    out = preprocess_fundus_image(sys.argv[1])
    cv2.imwrite(sys.argv[2], out)
    print(f"Saved preprocessed image to {sys.argv[2]}")
