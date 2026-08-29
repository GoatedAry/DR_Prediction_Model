"""
Preprocessing pipeline for Diabetic Retinopathy fundus images.
- V1: Background Masking -> Green Channel -> Median Filter -> CLAHE -> 224x224 (Matches best_model.pt)
- V2: Circular Contour Masking -> Graham Gaussian Lighting Normalization -> Dynamic Sizing
"""

import cv2
import numpy as np


# ---------------------------- V1 Pipeline (best_model.pt Compatible) ----------------------------

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
    """Remove noise while preserving lesion edges."""
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
    """Full V1 pipeline. Returns a (size, size, 3) uint8 array ready for the ResNet50 model."""
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    img = mask_background(img)
    green = isolate_green_channel(img)
    denoised = median_filter(green, ksize=3)
    enhanced = apply_clahe(denoised)
    final = resize_and_stack(enhanced, size=size)
    return final


# ---------------------------- V2 Pipeline (Clinical / Retraining Upgrades) ----------------------------

def crop_image_from_gray(img: np.ndarray, tol: int = 7) -> np.ndarray:
    """Detect circular retinal boundary and tightly crop out surrounding darkness."""
    if img.ndim == 2:
        mask = img > tol
        return img[np.ix_(mask.any(1), mask.any(0))]
    elif img.ndim == 3:
        gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mask = gray_img > tol
        check_shape = img[:, :, 0][np.ix_(mask.any(1), mask.any(0))].shape[0]
        if check_shape == 0:
            return img
        img1 = img[:, :, 0][np.ix_(mask.any(1), mask.any(0))]
        img2 = img[:, :, 1][np.ix_(mask.any(1), mask.any(0))]
        img3 = img[:, :, 2][np.ix_(mask.any(1), mask.any(0))]
        return np.stack([img1, img2, img3], axis=-1)
    return img


def ben_graham_preprocessing(image_path: str, size: int = 224) -> np.ndarray:
    """V2 Pipeline: Circular crop + Ben Graham local lighting normalization."""
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    img = crop_image_from_gray(img)
    img = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    # Subtract local Gaussian blur to remove camera lighting inconsistencies
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=size / 30)
    enhanced = cv2.addWeighted(img, 4, blurred, -4, 128)
    return enhanced


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python preprocessing.py <input_image> <output_image> [--v2]")
        sys.exit(1)
    
    use_v2 = "--v2" in sys.argv
    out = ben_graham_preprocessing(sys.argv[1]) if use_v2 else preprocess_fundus_image(sys.argv[1])
    cv2.imwrite(sys.argv[2], out)
    print(f"Saved preprocessed image to {sys.argv[2]} using {'V2 (Graham)' if use_v2 else 'V1 (CLAHE)'} pipeline.")