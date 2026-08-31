import os
import pandas as pd
import torch
from PIL import Image
from model import DRModel
from preprocessing import get_validation_transforms

STAGE_LABELS = {
    0: "No DR (Normal)",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR"
}

def fetch_and_test_random_sample(csv_path="train.csv", img_dir="train_images", weights_path="best_weights.pth"):
    # 1. Automatically fetch a random test sample and its true label
    df = pd.read_csv(csv_path)
    sample_row = df.sample(n=1).iloc[0]
    
    img_id = sample_row['id_code'] if 'id_code' in sample_row else sample_row.iloc[0]
    true_label = int(sample_row['diagnosis']) if 'diagnosis' in sample_row else int(sample_row.iloc[1])
    
    # Locate image file path
    img_path = None
    for ext in ['.png', '.jpg', '.jpeg']:
        potential_path = os.path.join(img_dir, f"{img_id}{ext}")
        if os.path.exists(potential_path):
            img_path = potential_path
            break
            
    if not img_path:
        potential_path = os.path.join(img_dir, img_id)
        if os.path.exists(potential_path):
            img_path = potential_path

    if not img_path or not os.path.exists(img_path):
        print(f"Error: Could not locate image file for ID: {img_id}")
        return

    print("\n" + "="*60)
    print(f"TEST IMAGE: {img_path}")
    print(f"VERIFIED GROUND TRUTH: Stage {true_label} ({STAGE_LABELS[true_label]})")
    print("="*60)

    # 2. Setup device and load model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DRModel(num_classes=5).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()
    
    # 3. Preprocess and run inference
    transform = get_validation_transforms(image_size=224)
    image = Image.open(img_path).convert("RGB")
    input_tensor = transform(image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        predicted_class = torch.argmax(probabilities).item()
        confidence = probabilities[predicted_class].item()
        
    # 4. Display model output vs ground truth
    print(f"MODEL PREDICTION:    Stage {predicted_class} ({STAGE_LABELS[predicted_class]})")
    print(f"CONFIDENCE SCORE:    {confidence:.2%}")
    
    match_status = "MATCH (Correct)" if predicted_class == true_label else "MISMATCH (Incorrect)"
    print(f"VERDICT:             {match_status}")
    print("="*60 + "\n")

    print("Full Stage Probability Distribution:")
    for stage, prob in enumerate(probabilities):
        print(f"  Stage {stage} ({STAGE_LABELS[stage]}): {prob.item():.2%}")

if __name__ == "__main__":
    fetch_and_test_random_sample()