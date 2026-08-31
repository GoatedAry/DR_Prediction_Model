"""
Preprocessing interface for the diabetes ML model.

The actual feature list and preprocessing pipeline have not
yet been finalized by the ML team.

Do not add assumptions about age, BMI, glucose, HbA1c, etc.
until the training specification is confirmed.
"""

from typing import Any


def preprocess(features: Any) -> Any:
    """
    Prepare diabetes model input.

    This function will be implemented once the final training
    preprocessing pipeline is confirmed.
    """
    raise NotImplementedError(
        "Diabetes preprocessing is not implemented yet. "
        "The final feature and preprocessing specification "
        "is required."
    )