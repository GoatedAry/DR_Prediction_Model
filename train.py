import torch
from torch.utils.data import DataLoader, random_split
from model import DRModel
from dataset import RetinalDataset
from preprocessing import get_training_transforms, get_validation_transforms
from advanced_loss_regularization import FocalCosineLoss, get_regularized_optimizer

def train_model(csv_path="train.csv", img_dir="train_images", epochs=15, batch_size=16):
    # Force detection of NVIDIA GPU
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")
    if device.type == 'cpu':
        print("WARNING: PyTorch is still using the CPU! Check your CUDA installation.")

    full_dataset = RetinalDataset(csv_file=csv_path, img_dir=img_dir, transform=get_training_transforms(224))
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_set, val_set = random_split(full_dataset, [train_size, val_size])

    # Optimized DataLoader settings for GPU pipelines
    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True)

    model = DRModel(num_classes=5, pretrained=True).to(device)
    criterion = FocalCosineLoss(gamma=2.0, label_smoothing=0.1, num_classes=5)
    optimizer = get_regularized_optimizer(model, learning_rate=1e-4, weight_decay=1e-2)
    
    # Initialize GradScaler for Mixed Precision Training
    scaler = torch.amp.GradScaler('cuda' if device.type == 'cuda' else 'cpu')

    best_val_loss = float("inf")

    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            
            # Autocast enables mixed precision for faster GPU processing
            with torch.amp.autocast('cuda' if device.type == 'cuda' else 'cpu'):
                outputs = model(images)
                loss = criterion(outputs, labels)
                
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            
            train_loss += loss.item() * images.size(0)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                with torch.amp.autocast('cuda' if device.type == 'cuda' else 'cpu'):
                    outputs = model(images)
                    loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)

        epoch_train_loss = train_loss / train_size
        epoch_val_loss = val_loss / val_size
        print(f"Epoch [{epoch+1}/{epochs}] - Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f}")

        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            torch.save(model.state_dict(), "best_weights.pth")
            print("--> Checkpoint saved: best_weights.pth")

if __name__ == "__main__":
    train_model()