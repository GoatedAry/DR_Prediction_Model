"""
Model architectures for DR staging:
* DROrdinalRegressor: ResNet50 backbone
* MedicalDROrdinalRegressor: EfficientNet B3 with Monte Carlo Dropout uncertainty support
"""

import torch
import torch.nn as nn
from torchvision.models import (
    resnet50, ResNet50_Weights,
    efficientnet_b3, EfficientNet_B3_Weights
)

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

    def forward(self, x, mc_dropout: bool = False):
        features = self.backbone(x)
        if mc_dropout:
            features = nn.functional.dropout(features, p=0.4, training=True)
            out = self.head[1](features)
        else:
            out = self.head(features)
        return out.squeeze(1)

def build_model(device: torch.device, dropout: float = 0.4) -> DROrdinalRegressor:
    model = DROrdinalRegressor(dropout=dropout)
    return model.to(device)

class MedicalDROrdinalRegressor(nn.Module):
    def __init__(self, dropout: float = 0.5):
        super().__init__()
        self.backbone = efficientnet_b3(weights=EfficientNet_B3_Weights.DEFAULT)

        for param in self.backbone.parameters():
            param.requires_grad = False

        for param in self.backbone.features[6:].parameters():
            param.requires_grad = True

        num_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()
        self.dropout_rate = dropout
        self.regressor = nn.Linear(num_features, 1)

    def forward(self, x, mc_dropout: bool = False):
        features = self.backbone(x)
        if mc_dropout:
            features = nn.functional.dropout(features, p=self.dropout_rate, training=True)
            out = self.regressor(features)
        else:
            features = nn.functional.dropout(features, p=self.dropout_rate, training=self.training)
            out = self.regressor(features)
        return out.squeeze(1)

def build_v2_model(device: torch.device, dropout: float = 0.5) -> MedicalDROrdinalRegressor:
    model = MedicalDROrdinalRegressor(dropout=dropout)
    return model.to(device)