"""
Unit tests for the diabetic retinopathy inference layer.

These tests do NOT require best_model.pt.

A dummy model is used to verify that:
    image
      -> preprocessing
      -> tensor conversion
      -> model inference
      -> ordinal stage conversion
      -> RetinopathyPrediction

works correctly.
"""

from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn

from ml.retinopathy.predictor import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    STAGE_NAMES,
)
from ml.retinopathy.preprocessing import preprocess_fundus_image
from ml.retinopathy.schemas import RetinopathyPrediction


class DummyDRModel(nn.Module):
    """
    Dummy model used for testing.

    It always returns the same raw severity score.
    This allows us to test the predictor's post-processing
    without loading the real 90 MB checkpoint.
    """

    def __init__(self, raw_score: float):
        super().__init__()
        self.raw_score = raw_score

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size = x.shape[0]

        return torch.full(
            (batch_size,),
            self.raw_score,
            dtype=torch.float32,
            device=x.device,
        )


class DummyRetinopathyPredictor:
    """
    Lightweight version of RetinopathyPredictor for unit testing.

    It uses the real preprocessing pipeline and a dummy model.
    """

    def __init__(
        self,
        raw_score: float,
        device: torch.device | None = None,
    ):
        self.device = device or torch.device("cpu")
        self.model = DummyDRModel(raw_score).to(self.device)
        self.model.eval()

    def predict(
        self,
        image_path: str | Path,
    ) -> RetinopathyPrediction:

        # Same preprocessing used by the real predictor.
        image = preprocess_fundus_image(image_path)

        # Same normalization used by the real predictor.
        image = image.astype(np.float32) / 255.0

        image = (
            image - IMAGENET_MEAN
        ) / IMAGENET_STD

        # HWC -> CHW + batch dimension.
        tensor = torch.from_numpy(
            image.transpose(2, 0, 1)
        ).unsqueeze(0)

        tensor = tensor.to(self.device)

        # Dummy inference.
        with torch.no_grad():
            raw_score = self.model(tensor).item()

        # Same ordinal post-processing as the real predictor.
        stage = int(
            np.clip(
                round(raw_score),
                0,
                4,
            )
        )

        return RetinopathyPrediction(
            stage=stage,
            prediction=STAGE_NAMES[stage],
            raw_score=float(raw_score),
        )


def create_test_image(tmp_path: Path) -> Path:
    """
    Create a small synthetic fundus-like image for testing.

    The image is deliberately simple because these tests are
    testing the software pipeline, not medical image quality.
    """

    image = np.zeros(
        (400, 400, 3),
        dtype=np.uint8,
    )

    # Create a circular non-black region so that
    # background masking has something to detect.
    cv2.circle(
        image,
        center=(200, 200),
        radius=170,
        color=(80, 100, 120),
        thickness=-1,
    )

    # Add a few brighter structures.
    cv2.circle(
        image,
        center=(200, 200),
        radius=40,
        color=(150, 150, 150),
        thickness=-1,
    )

    image_path = tmp_path / "sample_fundus.png"

    success = cv2.imwrite(
        str(image_path),
        image,
    )

    assert success

    return image_path


def test_preprocessing_output_shape(tmp_path):
    """
    Preprocessing should produce a 224x224 RGB-like
    three-channel uint8 image.
    """

    image_path = create_test_image(tmp_path)

    processed = preprocess_fundus_image(image_path)

    assert processed.shape == (224, 224, 3)
    assert processed.dtype == np.uint8


def test_preprocessing_creates_three_channels(tmp_path):
    """
    The preprocessing pipeline should replicate the processed
    green channel across all three output channels.
    """

    image_path = create_test_image(tmp_path)

    processed = preprocess_fundus_image(image_path)

    assert np.array_equal(
        processed[:, :, 0],
        processed[:, :, 1],
    )

    assert np.array_equal(
        processed[:, :, 1],
        processed[:, :, 2],
    )


def test_predictor_returns_prediction(tmp_path):
    """
    The dummy predictor should return the standardized
    RetinopathyPrediction schema.
    """

    image_path = create_test_image(tmp_path)

    predictor = DummyRetinopathyPredictor(
        raw_score=2.734,
    )

    result = predictor.predict(image_path)

    assert isinstance(
        result,
        RetinopathyPrediction,
    )

    assert result.raw_score == 2.734
    assert result.stage == 3
    assert result.prediction == "Severe NPDR"


def test_stage_rounding(tmp_path):
    """
    A raw ordinal regression score should be rounded
    to the nearest DR stage.
    """

    image_path = create_test_image(tmp_path)

    predictor = DummyRetinopathyPredictor(
        raw_score=1.7,
    )

    result = predictor.predict(image_path)

    assert result.stage == 2
    assert result.prediction == "Moderate NPDR"


def test_stage_lower_bound(tmp_path):
    """
    Scores below zero should be clipped to stage 0.
    """

    image_path = create_test_image(tmp_path)

    predictor = DummyRetinopathyPredictor(
        raw_score=-2.0,
    )

    result = predictor.predict(image_path)

    assert result.stage == 0
    assert result.prediction == "No DR"


def test_stage_upper_bound(tmp_path):
    """
    Scores above four should be clipped to stage 4.
    """

    image_path = create_test_image(tmp_path)

    predictor = DummyRetinopathyPredictor(
        raw_score=8.0,
    )

    result = predictor.predict(image_path)

    assert result.stage == 4
    assert result.prediction == "Proliferative DR"


def test_all_stage_names_exist():
    """
    The predictor should have a human-readable label
    for every valid DR stage.
    """

    assert set(STAGE_NAMES.keys()) == {0, 1, 2, 3, 4}

    for stage in range(5):
        assert isinstance(
            STAGE_NAMES[stage],
            str,
        )
        assert STAGE_NAMES[stage]