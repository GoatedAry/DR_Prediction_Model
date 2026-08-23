"""
ResNet50-based Ordinal Regression model for DR staging.
- Pretrained ResNet50 backbone
- layer3 + layer4 fine-tuned (deeper unfreeze than the original paper's
  "final layers only" - used in the max-accuracy training run)
- Head: Dropout -> single Dense (regression) output

IMPORTANT: freeze_until_layer must stay "layer3" to match the weights in
best_model.pt from the Kaggle run. Changing it changes which layers exist
as trainable vs frozen at construction time - it doesn't affect inference
correctness (all weights load either way), but keep it consistent if you
plan to fine-tune further from this checkpoint.
"""

import torch
import torch.nn as nn
from torchvision.models import resnet50, ResNet50_Weights


class DROrdinalRegressor(nn.Module):
    def __init__(self, dropout: float = 0.4, freeze_until_layer: str = "layer3"):
        super().__init__()
        backbone = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

        for param in backbone.parameters():
            param.requires_grad = False

        unfreeze = False
        for name, module in backbone.named_children():
            if name == freeze_until_layer:
                unfreeze = True
            if unfreeze:
                for param in module.parameters():
                    param.requires_grad = True

        num_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone

        self.head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(num_features, 1),
        )

    def forward(self, x):
        features = self.backbone(x)
        out = self.head(features)
        return out.squeeze(1)


def build_model(device: torch.device, dropout: float = 0.4) -> DROrdinalRegressor:
    model = DROrdinalRegressor(dropout=dropout)
    return model.to(device)
