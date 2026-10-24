import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/orders", tags=["Orders"])


class OrderPayload(BaseModel):
    patient_id: str
    clinician_name: str
    selected_orders: list[str]


@router.post("/sign-and-transmit")
def sign_order_bundle(order: OrderPayload):
    timestamp = datetime.now(timezone.utc).isoformat()

    # This is a SHA-256 content hash for the submitted bundle. It is not
    # a digital signature, clinician identity proof, or EHR/FHIR transmission.
    payload_string = f"{order.patient_id}|{order.clinician_name}|{','.join(order.selected_orders)}|{timestamp}"
    signature = hashlib.sha256(payload_string.encode()).hexdigest()

    return {
        "status": "SIMULATED_RECEIPT_RECORDED",
        "note": "A simulated reviewer acknowledgement receipt was recorded locally; no EHR connection or transmission occurred.",
        "patient_id": order.patient_id,
        "signed_by": order.clinician_name,
        "order_count": len(order.selected_orders),
        "orders": order.selected_orders,
        "timestamp": timestamp,
        "integrity_signature_sha256": signature,
    }
