import os
import json
import pandas as pd
import torch
from PIL import Image
from model import DRModel
from preprocessing import get_validation_transforms
import explainability as exp

STAGE_LABELS = {
    0: "Normal", 1: "Mild DR", 2: "Moderate DR", 3: "Severe DR", 4: "Proliferative DR"
}

def simulate_api_inference(csv_path="train.csv", img_dir="train_images", weights_path="best_weights.pth", sensitivity_threshold=0.65):
    df = pd.read_csv(csv_path)
    sample_row = df.sample(n=1).iloc[0]
    
    img_id = sample_row['id_code']
    img_path = os.path.join(img_dir, f"{img_id}.png")

    if not os.path.exists(img_path):
        print(json.dumps({"error": f"Image {img_id} not found."}))
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DRModel(num_classes=5).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()
    
    transform = get_validation_transforms(image_size=224)
    raw_image_pil = Image.open(img_path).convert("RGB")
    input_tensor = transform(raw_image_pil).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        predicted_class = torch.argmax(probabilities).item()
        confidence = probabilities[predicted_class].item()

    with torch.set_grad_enabled(True):
        input_tensor.requires_grad_(True)
        grayscale_cam = exp.get_base_gradcam(model, input_tensor, predicted_class)

    # 1. Save pure visual heatmap for the frontend to render as a base layer
    heatmap_overlay = exp.generate_standard_heatmap_overlay(grayscale_cam, raw_image_pil, image_size=224)
    heatmap_img = Image.fromarray((heatmap_overlay * 255).astype('uint8'))
    heatmap_filename = f"heatmap_base_{img_id}.png"
    heatmap_img.save(heatmap_filename)

    # 2. Extract dynamic coordinates
    bounding_boxes = exp.extract_bounding_box_coordinates(grayscale_cam, threshold=sensitivity_threshold)
    lesion_count = len(bounding_boxes)
    
    # 3. Calculate Severity Correlation Logic
    high_severity_flag = bool(predicted_class >= 3 and lesion_count >= 2)

    # 4. Construct JSON Response Payload
    api_response = {
        "status": "success",
        "data": {
            "image_id": img_id,
            "heatmap_url": f"/{heatmap_filename}",
            "prediction": {
                "stage": predicted_class,
                "diagnosis": STAGE_LABELS[predicted_class],
                "confidence": round(confidence, 4)
            },
            "severity_metrics": {
                "lesion_count": lesion_count,
                "high_severity_flag": high_severity_flag,
                "sensitivity_threshold_used": sensitivity_threshold,
                "clinical_note": "High number of focal lesions detected. Prioritize review." if high_severity_flag else "Standard review."
            },
            "bounding_boxes": bounding_boxes
        }
    }

    # Print the JSON to terminal (simulating an API returning data to a frontend)
    print(json.dumps(api_response, indent=4))

if __name__ == "__main__":
    # You can change the threshold here to simulate the frontend slider
    simulate_api_inference(sensitivity_threshold=0.65)