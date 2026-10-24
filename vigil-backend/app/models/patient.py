from sqlalchemy import Column, String, Float, Integer
from app.database import Base


class PatientModel(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)  # e.g. "MICU-402"
    name = Column(String, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    bed = Column(String)
    primary_dx = Column(String)

    # These column names (lowercase) map directly to FEATURE_NAMES in
    # app/ml_engine/model_loader.py — keep them in sync.
    hr = Column(Float)
    map = Column(Float)
    resp = Column(Float)
    temp = Column(Float)
    o2sat = Column(Float)
    lactate = Column(Float)
    wbc = Column(Float)
    platelets = Column(Float)
    creatinine = Column(Float)
    hco3 = Column(Float)
    bun = Column(Float)
    glucose = Column(Float)
    bilirubin_total = Column(Float)
