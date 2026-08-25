"""
High-level interface for diabetes ML inference.

The implementation is intentionally incomplete until the
actual diabetes model specification is provided.
"""

from typing import Any

from .model import DiabetesModel
from .preprocessing import preprocess
from .schemas import DiabetesPrediction


class DiabetesPredictor:
    """
    Public interface for diabetes prediction.

    Member A should eventually be able to use:

        predictor = DiabetesPredictor()
        result = predictor.predict(features)

    without knowing the internal model implementation.
    """

    def __init__(
        self,
        model: DiabetesModel | None = None,
    ):
        self.model = model or DiabetesModel()

    def predict(
        self,
        features: Any,
    ) -> DiabetesPrediction:
        """
        Run diabetes prediction.

        The actual implementation will be completed once
        the diabetes model specification is confirmed.
        """

        processed_features = preprocess(features)

        raw_output = self.model.predict(
            processed_features
        )

        return DiabetesPrediction(
            prediction=raw_output,
            raw_output=raw_output,
        )