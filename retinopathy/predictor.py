"""
High-level inference interface for the diabetic retinopathy model.

Public interface:

    predictor = RetinopathyPredictor()
    result = predictor.predict(image_path)

The predictor handles:
    1. Model initialization
    2. Checkpoint loading
    3. Image preprocessing
    4. ImageNet normalization
    5. Model inference
    6. Ordinal post-processing
    7. Standardized prediction output
"""

from pathlib import Path

import numpy as np
import torch

from .model import build_model, get_device, load_checkpoint
from .preprocessing import preprocess_fundus_image
from .schemas import RetinopathyPrediction


# ImageNet normalization used by the original inference code.
IMAGENET_MEAN = np.array(
    [0.485, 0.456, 0.406],
    dtype=np.float32,
)

IMAGENET_STD = np.array(
    [0.229, 0.224, 0.225],
    dtype=np.float32,
)


# The five DR stages used by the trained model.
STAGE_NAMES = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}


class RetinopathyPredictor:
    """
    High-level diabetic retinopathy inference interface.

    The model is loaded once when the predictor is created and then
    reused for subsequent predictions.
    """

    def __init__(
        self,
        checkpoint_path: str | Path | None = None,
        device: torch.device | None = None,
    ):
        """
        Initialize the predictor.

        Parameters
        ----------
        checkpoint_path:
            Path to best_model.pt.

            If omitted, the default location is:

                ml/retinopathy/weights/best_model.pt

        device:
            Optional PyTorch device.

            If omitted, CUDA is used when available,
            otherwise CPU.
        """

        if checkpoint_path is None:
            checkpoint_path = (
                Path(__file__).resolve().parent
                / "weights"
                / "best_model.pt"
            )

        self.checkpoint_path = Path(checkpoint_path)

        self.device = (
            device
            if device is not None
            else get_device()
        )

        # Build the model architecture.
        self.model = build_model(
            device=self.device,
        )

        # Load trained weights.
        #
        # This will raise a clear FileNotFoundError right now
        # because best_model.pt is not on your PC yet.
        self.model = load_checkpoint(
            model=self.model,
            checkpoint_path=self.checkpoint_path,
            device=self.device,
        )

    def predict(
        self,
        image_path: str | Path,
    ) -> RetinopathyPrediction:
        """
        Run diabetic retinopathy inference on one fundus image.

        Parameters
        ----------
        image_path:
            Path to the fundus image.

        Returns
        -------
        RetinopathyPrediction
            Standardized prediction containing:
                - stage
                - prediction
                - raw_score
        """

        # ----------------------------------------
        # 1. Preprocess the fundus image
        # ----------------------------------------

        image = preprocess_fundus_image(
            image_path=image_path,
        )

        # ----------------------------------------
        # 2. Convert uint8 -> float32
        # ----------------------------------------

        image = image.astype(
            np.float32,
        ) / 255.0

        # ----------------------------------------
        # 3. ImageNet normalization
        # ----------------------------------------

        image = (
            image - IMAGENET_MEAN
        ) / IMAGENET_STD

        # ----------------------------------------
        # 4. HWC -> CHW
        #    Add batch dimension
        # ----------------------------------------

        tensor = torch.from_numpy(
            image.transpose(2, 0, 1)
        ).unsqueeze(0)

        tensor = tensor.to(self.device)

        # ----------------------------------------
        # 5. Model inference
        # ----------------------------------------

        with torch.no_grad():
            raw_score = self.model(
                tensor
            ).item()

        # ----------------------------------------
        # 6. Convert continuous score to stage
        # ----------------------------------------

        stage = int(
            np.clip(
                round(raw_score),
                0,
                4,
            )
        )

        prediction = STAGE_NAMES[stage]

        # ----------------------------------------
        # 7. Return standardized result
        # ----------------------------------------

        return RetinopathyPrediction(
            stage=stage,
            prediction=prediction,
            raw_score=float(raw_score),
        )