"""
Preprocessing pipeline for Diabetic Retinopathy fundus images.
Includes V1 CLAHE pipeline, V2 Graham lighting normalization, and PyTorch Training Augmentations.
"""

import cv2
import numpy as np
import torch
from torchvision import transforms

def mask_background(img: np.ndarray, threshold: int = 10) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    mask = gray > threshold
    if mask.sum() == 0:
        return img
    coords = np.argwhere(mask)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1
    return img[y0:y1, x0:x1]

def isolate_green_channel(img: np.ndarray) -> np.ndarray:
    return img[:, :, 1]

def median_filter(img: np.ndarray, ksize: int = 3) -> np.ndarray:
    return cv2.medianBlur(img, ksize)

def apply_clahe(img: np.ndarray, clip_limit: float = 2.0, tile_grid_size=(8, 8)) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(img)

def resize_and_stack(img: np.ndarray, size: int = 224) -> np.ndarray:
    resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    return cv2.merge([resized, resized, resized])

def preprocess_fundus_image(image_path: str, size: int = 224) -> np.ndarray:
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    img = mask_background(img)
    green = isolate_green_channel(img)
    denoised = median_filter(green, ksize=3)
    enhanced = apply_clahe(denoised)
    final = resize_and_stack(enhanced, size=size)
    return final

def crop_image_from_gray(img: np.ndarray, tol: int = 7) -> np.ndarray:
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
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    img = crop_image_from_gray(img)
    img = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=size / 30)
    enhanced = cv2.addWeighted(img, 4, blurred, -4, 128)
    return enhanced

def get_training_transforms(size: int = 224):
    """
    Advanced data augmentation for training iterations.
    Includes morphological shifts, color jittering, and cutout.
    """
    return transforms.Compose([
        transforms.ToTensor(),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
        transforms.RandomErasing(p=0.5, scale=(0.02, 0.1), ratio=(0.3, 3.3), value=0),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python preprocessing.py <input_image> <output_image> [--v2]")
        sys.exit(1)
    
    use_v2 = "--v2" in sys.argv
    out = ben_graham_preprocessing(sys.argv[1]) if use_v2 else preprocess_fundus_image(sys.argv[1])
    cv2.imwrite(sys.argv[2], out)
    print(f"Saved preprocessed image to {sys.argv[2]}")