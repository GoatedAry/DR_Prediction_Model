import cv2
import numpy as np
import torch
import torch.nn as nn
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

def get_last_conv_layer(model):
    last_conv_layer = None
    for module in model.modules():
        if isinstance(module, nn.Conv2d):
            last_conv_layer = module
    if last_conv_layer is None:
        raise ValueError("Could not find a convolutional layer in the model.")
    return last_conv_layer

def get_base_gradcam(model, input_tensor, predicted_class):
    target_layer = get_last_conv_layer(model)
    cam = GradCAM(model=model, target_layers=[target_layer])
    targets = [ClassifierOutputTarget(predicted_class)]
    grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0, :]
    return grayscale_cam

def generate_standard_heatmap_overlay(grayscale_cam, raw_image_pil, image_size=224):
    raw_image_resized = raw_image_pil.resize((image_size, image_size))
    img_array = np.array(raw_image_resized).astype(np.float32) / 255.0
    heatmap_overlay = show_cam_on_image(img_array, grayscale_cam, use_rgb=True)
    return heatmap_overlay

def extract_bounding_box_coordinates(grayscale_cam, threshold):
    """
    Dynamically thresholds the raw heatmap and extracts JSON-friendly coordinates.
    """
    cam_uint8 = (grayscale_cam * 255).astype(np.uint8)
    _, binarized_mask = cv2.threshold(cam_uint8, int(threshold * 255), 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binarized_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    for contour in contours:
        if cv2.contourArea(contour) > 50:
            x, y, w, h = cv2.boundingRect(contour)
            boxes.append({
                "x": int(x), 
                "y": int(y), 
                "width": int(w), 
                "height": int(h)
            })
            
    return boxes