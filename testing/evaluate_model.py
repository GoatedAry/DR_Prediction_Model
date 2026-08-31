import sys
import torch
from torch.utils.data import DataLoader, random_split

sys.path.append('..')
from model import DRModel
from dataset import RetinalDataset
from preprocessing import get_validation_transforms
from clinical_metrics import generate_clinical_report

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Running evaluation on {device}...")
    
    model = DRModel(num_classes=5).to(device)
    model.load_state_dict(torch.load('../best_weights.pth', map_location=device))
    model.eval()
    
    # Load full dataset using the same parameters as train.py
    full_dataset = RetinalDataset(
        csv_file='../train.csv', 
        img_dir='../train_images', 
        transform=get_validation_transforms(224)
    )
    
    # Replicate the 80/20 train/validation split to isolate the validation set
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    _, val_set = random_split(full_dataset, [train_size, val_size])
    
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False, num_workers=2, pin_memory=True)
    
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in val_loader:
            images = images.to(device)
            logits = model(images)
            probs = torch.softmax(logits, dim=1)
            all_preds.extend(probs.cpu().numpy())
            all_labels.extend(labels.numpy())
            
    generate_clinical_report(all_labels, all_preds)

if __name__ == "__main__":
    main()