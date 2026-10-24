import logging
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.database import engine, SessionLocal, Base
from app.models.patient import PatientModel
from app.seed import DEMO_PATIENTS

Base.metadata.create_all(bind=engine)


def main():
    db = SessionLocal()
    try:
        for p in DEMO_PATIENTS:
            existing = db.query(PatientModel).filter(PatientModel.id == p["id"]).first()
            if existing:
                for key, value in p.items():
                    setattr(existing, key, value)
                continue
            db.add(PatientModel(**p))
        db.commit()
        print(f"Seeded or refreshed {len(DEMO_PATIENTS)} fictional demo patients.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
