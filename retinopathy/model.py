"""
ResNet50-based ordinal regression model for diabetic retinopathy.

Architecture:
    ResNet50 backbone
    -> Dropout
    -> Linear(2048, 1)

The architecture matches the model used to train best_model.pt.
"""

from pathlib import Path

import torch
import torch.nn as nn
from torchvision.models import ResNet50_Weights, resnet50


class DROrdinalRegressor(nn.Module):
    """
    ResNet50 model with a single regression output.

    The model predicts a continuous DR severity score.
    The predictor later converts that score into an ordinal stage (0-4).
    """

    def __init__(
        self,
        dropout: float = 0.4,
        freeze_until_layer: str = "layer3",
    ):
        super().__init__()

        backbone = resnet50(
            weights=ResNet50_Weights.IMAGENET1K_V2
        )

        # Freeze the entire backbone first.
        for param in backbone.parameters():
            param.requires_grad = False

        # Unfreeze layer3 and everything after it.
        unfreeze = False

        for name, module in backbone.named_children():
            if name == freeze_until_layer:
                unfreeze = True

            if unfreeze:
                for param in module.parameters():
                    param.requires_grad = True

        # ResNet50's final feature size is 2048.
        num_features = backbone.fc.in_features

        # Remove the original ImageNet classification layer.
        backbone.fc = nn.Identity()

        self.backbone = backbone

        # Ordinal regression head.
        self.head = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(num_features, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Run a forward pass.

        Returns:
            Tensor containing one continuous severity score per image.
        """
        features = self.backbone(x)
        output = self.head(features)

        return output.squeeze(1)


def build_model(
    device: torch.device,
    dropout: float = 0.4,
) -> DROrdinalRegressor:
    """
    Construct the DR model and move it to the requested device.
    """
    model = DROrdinalRegressor(
        dropout=dropout,
        freeze_until_layer="layer3",
    )

    return model.to(device)


def load_checkpoint(
    model: DROrdinalRegressor,
    checkpoint_path: str | Path,
    device: torch.device,
) -> DROrdinalRegressor:
    """
    Load trained weights into the model.

    Parameters
    ----------
    model:
        Constructed DROrdinalRegressor.

    checkpoint_path:
        Path to best_model.pt.

    device:
        Device used for inference.

    Returns
    -------
    DROrdinalRegressor
        Model with loaded weights in evaluation mode.

    Raises
    ------
    FileNotFoundError
        If the checkpoint does not exist.
    """
    checkpoint_path = Path(checkpoint_path)

    if not checkpoint_path.is_file():
        raise FileNotFoundError(
            f"DR model checkpoint not found: {checkpoint_path}"
        )

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
    )

    model.load_state_dict(checkpoint)
    model.eval()

    return model


def get_device() -> torch.device:
    """
    Select CUDA when available, otherwise CPU.
    """
    return torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )