"""
Quick manual test for the /assess endpoint.
Avoids PowerShell curl quoting headaches entirely.

Run this in a SECOND terminal while `uvicorn api.server:app --reload`
is running in the first one.

Usage:
    python test_api.py
"""
import json
import requests

# --- adjust these two things for your setup ---------------------------
CGM_CSV_PATH = "CGMacros/CGMacros-005/CGMacros-005.csv"
CLINICAL_JSON = {
    "age": 45,
    "bmi": 28.1,
    "fasting_glucose": 98,
    "gender": "M",
}
# ------------------------------------------------------------------------

URL = "http://localhost:8000/assess"


def main():
    with open(CGM_CSV_PATH, "rb") as f:
        files = {"cgm_file": (CGM_CSV_PATH.split("/")[-1], f, "text/csv")}
        data = {"clinical_json": json.dumps(CLINICAL_JSON)}
        resp = requests.post(URL, files=files, data=data)

    print(f"Status: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), indent=2))
    except ValueError:
        print(resp.text)


if __name__ == "__main__":
    main()
