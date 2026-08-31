import pandas as pd
import os

def fetch_random_test_sample(csv_path="train.csv", img_dir="train_images"):
    df = pd.read_csv(csv_path)
    
    # Pick a random row from your dataset
    sample_row = df.sample(n=1).iloc[0]
    
    img_id = sample_row['id_code'] if 'id_code' in sample_row else sample_row.iloc[0]
    label = int(sample_row['diagnosis']) if 'diagnosis' in sample_row else int(sample_row.iloc[1])
    
    # Locate image extension
    img_path = None
    for ext in ['.png', '.jpg', '.jpeg']:
        potential_path = os.path.join(img_dir, f"{img_id}{ext}")
        if os.path.exists(potential_path):
            img_path = potential_path
            break
            
    if not img_path:
        # Check if extension is already embedded in id_code
        potential_path = os.path.join(img_dir, img_id)
        if os.path.exists(potential_path):
            img_path = potential_path

    stage_names = {
        0: "No DR (Normal)",
        1: "Mild DR",
        2: "Moderate DR",
        3: "Severe DR",
        4: "Proliferative DR"
    }

    print("\n" + "="*50)
    print(f"TARGET TEST IMAGE FILE: {img_path}")
    print(f"VERIFIED GROUND TRUTH LABEL: Stage {label} ({stage_names[label]})")
    print("="*50 + "\n")
    
    return img_path

if __name__ == "__main__":
    fetch_random_test_sample()