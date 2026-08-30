"""
Preprocessing pipeline for diabetic retinopathy fundus images.

Pipeline:
    Background Masking
        -> Green Channel Isolation
        -> Median Filtering
        -> CLAHE
        -> Resize to 224x224
        -> 3-channel recreation

This matches the preprocessing pipeline used during training
and the original inference implementation.
"""

from pathlib import Path

import cv2
import numpy as np


def mask_background(
    img: np.ndarray,
    threshold: int = 10,
) -> np.ndarray:
    """
    Crop the black background surrounding the fundus region.

    Parameters
    ----------
    img:
        Input image as a NumPy array.

    threshold:
        Pixel intensity threshold used to identify the fundus region.

    Returns
    -------
    np.ndarray
        Cropped image.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

    mask = gray > threshold

    # If the image contains no pixels above the threshold,
    # return it unchanged.
    if mask.sum() == 0:
        return img

    coords = np.argwhere(mask)

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1

    return img[y0:y1, x0:x1]


def isolate_green_channel(img: np.ndarray) -> np.ndarray:
    """
    Extract the green channel from a BGR image.

    OpenCV uses BGR ordering:
        channel 0 -> Blue
        channel 1 -> Green
        channel 2 -> Red
    """
    if img.ndim != 3 or img.shape[2] != 3:
        raise ValueError("Expected a 3-channel BGR image.")

    return img[:, :, 1]


def median_filter(
    img: np.ndarray,
    ksize: int = 3,
) -> np.ndarray:
    """
    Apply median filtering to reduce noise while preserving edges.
    """
    return cv2.medianBlur(img, ksize)


def apply_clahe(
    img: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: tuple[int, int] = (8, 8),
) -> np.ndarray:
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE).
    """
    clahe = cv2.createCLAHE(
        clipLimit=clip_limit,
        tileGridSize=tile_grid_size,
    )

    return clahe.apply(img)


def resize_and_stack(
    img: np.ndarray,
    size: int = 224,
) -> np.ndarray:
    """
    Resize the processed single-channel image to size x size
    and replicate it across three channels.

    Returns:
        NumPy array with shape (size, size, 3).
    """
    resized = cv2.resize(
        img,
        (size, size),
        interpolation=cv2.INTER_AREA,
    )

    return cv2.merge([resized, resized, resized])


def preprocess_fundus_image(
    image_path: str | Path,
    size: int = 224,
) -> np.ndarray:
    """
    Run the complete fundus preprocessing pipeline.

    Parameters
    ----------
    image_path:
        Path to the retinal fundus image.

    size:
        Output spatial size. The trained model uses 224.

    Returns
    -------
    np.ndarray
        Preprocessed image with shape (224, 224, 3)
        and dtype uint8.

    Raises
    ------
    FileNotFoundError
        If the image cannot be read.
    ValueError
        If the image is not a valid 3-channel image.
    """
    image_path = Path(image_path)

    img = cv2.imread(
        str(image_path),
        cv2.IMREAD_COLOR,
    )

    if img is None:
        raise FileNotFoundError(
            f"Could not read fundus image: {image_path}"
        )

    img = mask_background(img)

    green = isolate_green_channel(img)

    denoised = median_filter(
        green,
        ksize=3,
    )

    enhanced = apply_clahe(
        denoised,
        clip_limit=2.0,
        tile_grid_size=(8, 8),
    )

    final = resize_and_stack(
        enhanced,
        size=size,
    )

    return final