from dataclasses import dataclass


@dataclass(frozen=True)
class RetinopathyPrediction:
    """
    Standardized result returned by the diabetic retinopathy predictor.

    stage:
        Ordinal DR stage from 0 to 4.

    prediction:
        Human-readable name of the predicted DR stage.

    raw_score:
        Raw continuous severity score produced by the ordinal
        regression model before rounding/clipping.
    """

    stage: int
    prediction: str
    raw_score: float