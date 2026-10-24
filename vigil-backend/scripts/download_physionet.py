"""
Downloads authentic clinical records from the official PhysioNet Challenge 2019 repository:
https://physionet.org/files/challenge-2019/1.0.0/training/training_setA/

Each patient file is a real ICU timeline (hourly vitals, labs, and Sepsis-3 labels).
"""

import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL_A = "https://physionet.org/files/challenge-2019/1.0.0/training/training_setA"
TARGET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")


def download_patient(patient_num: int, target_dir: str):
    filename = f"p{patient_num:06d}.psv"
    url = f"{BASE_URL_A}/{filename}"
    dest_path = os.path.join(target_dir, filename)

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=10) as response, open(dest_path, "wb") as out_file:
            data = response.read()
            if len(data) > 100:  # Valid non-empty file
                out_file.write(data)
                return True
    except Exception:
        pass
    return False


def main():
    # Number of patient records to download (default 500, or from sys.argv)
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    os.makedirs(TARGET_DIR, exist_ok=True)

    print(f"Downloading {count} real patient records from PhysioNet Challenge 2019 to {TARGET_DIR}...")
    success_count = 0

    with ThreadPoolExecutor(max_workers=25) as executor:
        futures = {executor.submit(download_patient, i, TARGET_DIR): i for i in range(1, count + 1)}
        for future in as_completed(futures):
            if future.result():
                success_count += 1
                if success_count % 50 == 0 or success_count == count:
                    print(f"  Downloaded {success_count}/{count} patient records...")

    print(f"Successfully downloaded {success_count} genuine PhysioNet clinical records.")


if __name__ == "__main__":
    main()
