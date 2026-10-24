"""Demo patient records used to seed the local SQLite database.

These are fictional demo profiles. They are not patients from the PhysioNet
files and must not be presented as real clinical records.
"""

from app.database import SessionLocal
from app.models.patient import PatientModel

DEMO_PATIENTS = [
    dict(
        id="MICU-402", name="Eleanor Vance", age=68, gender="F", bed="MICU-402",
        primary_dx="Suspected Urosepsis",
        hr=110, map=55.0, resp=30, temp=38.5, o2sat=90,
        lactate=4.2, wbc=18.0, platelets=120, creatinine=1.5,
        hco3=18.0, bun=32.0, glucose=180.0, bilirubin_total=2.1,
    ),
    dict(
        id="ICU-207", name="Priya Nair", age=71, gender="F", bed="ICU-207",
        primary_dx="Community-Acquired Pneumonia",
        hr=100, map=68.0, resp=22, temp=38.0, o2sat=92,
        lactate=2.1, wbc=14.0, platelets=250, creatinine=1.3,
        hco3=22.0, bun=24.0, glucose=140.0, bilirubin_total=1.2,
    ),
    dict(
        id="ICU-311", name="James O'Connor", age=45, gender="M", bed="ICU-311",
        primary_dx="Trauma, Motor Vehicle Accident",
        hr=88, map=80.0, resp=16, temp=37.0, o2sat=97,
        lactate=1.4, wbc=9.0, platelets=220, creatinine=0.9,
        hco3=24.0, bun=18.0, glucose=110.0, bilirubin_total=0.8,
    ),
    dict(
        id="MICU-114", name="Marcus Webb", age=54, gender="M", bed="MICU-114",
        primary_dx="Post-op Recovery, Hip Replacement",
        hr=65, map=90.0, resp=12, temp=36.2, o2sat=99,
        lactate=0.8, wbc=6.0, platelets=280, creatinine=0.7,
        hco3=26.0, bun=12.0, glucose=90.0, bilirubin_total=0.5,
    ),
]


def seed_if_empty():
    """Populate the demo records on first start when the table has no rows.

    Idempotent: it does nothing when patients already exist, so it never
    overwrites a database the developer has already edited.
    """
    db = SessionLocal()
    try:
        if db.query(PatientModel).count() > 0:
            return 0
        for record in DEMO_PATIENTS:
            db.add(PatientModel(**record))
        db.commit()
        return len(DEMO_PATIENTS)
    finally:
        db.close()
