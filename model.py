import torch
import torch.nn as nn
import torchvision.models as models

class DRModel(nn.Module):
    def __init__(self, num_classes=5, pretrained=True, drop_rate=0.2):
        super(DRModel, self).__init__()
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        self.base_model = models.efficientnet_b0(weights=weights)
        
        in_features = self.base_model.classifier[1].in_features
        self.base_model.classifier = nn.Sequential(
            nn.Dropout(p=drop_rate),
            nn.Linear(in_features, num_classes)
        )
        
    def forward(self, x):
        return self.base_model(x)

def apply_test_time_augmentation(model, image_tensor, device):
    """
    Applies Test Time Augmentation (TTA) by averaging predictions 
    across the original image and horizontal/vertical flips.
    """
    model.eval()
    image_tensor = image_tensor.to(device)
    
    with torch.no_grad():
        out_orig = torch.softmax(model(image_tensor), dim=1)
        out_hflip = torch.softmax(model(torch.flip(image_tensor, dims=[3])), dim=1)
        out_vflip = torch.softmax(model(torch.flip(image_tensor, dims=[2])), dim=1)
        
        final_probs = (out_orig + out_hflip + out_vflip) / 3.0
        
    return final_probs