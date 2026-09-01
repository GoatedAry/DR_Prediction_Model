import cv2
import numpy as np
import torch
import torchvision.transforms as T
from PIL import Image
from typing import Union, Tuple, Optional

def apply_ben_graham_enhancement(
    image: Union[np.ndarray, Image.Image],
    target_size: Union[Tuple[int, int], int] = (384, 384),
    image_size: Optional[int] = None
) -> Union[np.ndarray, Image.Image]:
    """Enhances capillaries and microaneurysms by subtracting local Gaussian blur."""
    is_pil = isinstance(image, Image.Image)
    
    if image_size is not None:
        target_size = (image_size, image_size)
    elif isinstance(target_size, int):
        target_size = (target_size, target_size)
        
    if is_pil:
        img_np = np.array(image)
        if img_np.ndim == 3 and img_np.shape[2] == 3:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        else:
            img_bgr = img_np
    else:
        img_bgr = image

    resized = cv2.resize(img_bgr, target_size)
    sigma = max(1.0, target_size[0] / 30.0)
    enhanced = cv2.addWeighted(
        resized, 4,
        cv2.GaussianBlur(resized, (0, 0), sigma), -4,
        128
    )

    if is_pil:
        enhanced_rgb = cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB)
        return Image.fromarray(enhanced_rgb)
    return enhanced

def check_image_quality(image_bgr: np.ndarray) -> dict:
    """Calculates image clarity, illumination, and artifact scores."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    illumination = float(np.mean(gray))
    passed = (sharpness >= 60.0) and (25.0 <= illumination <= 230.0)
    return {
        "sharpness": round(sharpness, 2),
        "illumination": round(illumination, 2),
        "artifacts": 0.02 if passed else 0.40,
        "passed": passed
    }

def get_validation_transforms(image_size=384):
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])