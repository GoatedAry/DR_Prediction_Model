"""
Model-loading interface for the diabetes prediction model.

The actual diabetes model architecture and file format have not
yet been finalized. Do not add model-specific assumptions here
until the ML team provides the specification.
"""

from pathlib import Path
from typing import Any


class DiabetesModel:
    """
    Placeholder interface for the future diabetes ML model.
    """

    def __init__(self, model_path: str | Path | None = None):
        self.model_path = (
            Path(model_path)
            if model_path is not None
            else None
        )

        self.model: Any = None

    def load(self) -> None:
        """
        Load the trained diabetes model.

        This will be implemented once the ML team confirms:
            - model architecture
            - model format
            - checkpoint location
            - required dependencies
        """
        raise NotImplementedError(
            "Diabetes model loading is not implemented yet. "
            "The final diabetes model specification is required."
        )

    def predict(self, features: Any) -> Any:
        """
        Run inference using the loaded diabetes model.
        """
        if self.model is None:
            raise RuntimeError(
                "Diabetes model has not been loaded."
            )

        return self.model.predict(features)