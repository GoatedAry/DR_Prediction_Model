"""
Schemas for the diabetes ML inference layer.

The actual diabetes model output is not finalized yet.
This schema is intentionally minimal and can be updated once
the ML team confirms the model specification.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DiabetesPrediction:
    """
    Standardized result returned by the diabetes predictor.

    prediction:
        Model-specific prediction.

    confidence:
        Optional confidence/probability if the final model
        provides one.

    raw_output:
        Original model output, preserved for debugging or
        future model-specific post-processing.
    """

    prediction: Any
    confidence: float | None = None
    raw_output: Any = None