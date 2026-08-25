"""
Tests for the diabetes inference interface.

The actual diabetes model is not available yet, so these tests
only verify that the public interface and result schema exist.
"""

import pytest

from ml.diabetes.model import DiabetesModel
from ml.diabetes.predictor import DiabetesPredictor
from ml.diabetes.schemas import DiabetesPrediction


def test_diabetes_predictor_exists():
    predictor = DiabetesPredictor()

    assert isinstance(
        predictor,
        DiabetesPredictor,
    )


def test_diabetes_model_requires_real_implementation():
    model = DiabetesModel()

    with pytest.raises(NotImplementedError):
        model.load()


def test_diabetes_prediction_schema():
    result = DiabetesPrediction(
        prediction="placeholder",
    )

    assert result.prediction == "placeholder"
    assert result.confidence is None
    assert result.raw_output is None