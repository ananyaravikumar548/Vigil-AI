"""Cost-controlled Groq narration with persistent, feature-specific caching."""

import hashlib
import json
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from groq import Groq

logger = logging.getLogger(__name__)
_client = None
_lock = threading.RLock()

DEFAULT_MODEL = "openai/gpt-oss-120b"
FALLBACK_LABEL = "Template summary (LLM unavailable)"
PROMPT_VERSION = "narration-v1"
CACHE_PATH = Path(__file__).with_name("narration_cache.json")

FEATURE_DISPLAY_NAMES = {
    "Bilirubin_total": "Bilirubin (total)",
    "HCO3": "Bicarbonate (HCO₃)",
    "O2Sat": "SpO₂",
    "Resp": "Respiratory rate",
    "HR": "Heart rate",
    "Temp": "Temperature",
}


def narration_model_name() -> str:
    """The Groq model used for narration."""
    return os.getenv("GROQ_MODEL", DEFAULT_MODEL)


def _limit(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        logger.warning("Invalid %s value; using default %s", name, default)
        return default


def per_ip_daily_limit() -> int:
    return _limit("MAX_LIVE_NARRATIONS_PER_IP_PER_DAY", 6)


def global_daily_limit() -> int:
    return _limit("MAX_LIVE_NARRATIONS_PER_DAY", 50)


def _utc_day() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key or api_key == "your-groq-api-key-here":
            return None
        _client = Groq(api_key=api_key)
    return _client


def _load_cache() -> dict:
    try:
        payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        entries = payload.get("entries", {})
        return entries if isinstance(entries, dict) else {}
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}


_narration_cache: dict[str, dict] = _load_cache()
_live_calls_by_ip: dict[tuple[str, str], int] = {}
_live_calls_global: dict[str, int] = {}


def _persist_cache() -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"cache_version": 1, "entries": _narration_cache}
    temporary_path = CACHE_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_path.replace(CACHE_PATH)


def _feature_hash(feature_values: list) -> str:
    ordered_values = json.dumps(feature_values, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(ordered_values.encode("utf-8")).hexdigest()


def narration_cache_key(patient_id: str, feature_values: list, model: str | None = None) -> str:
    model_name = model or narration_model_name()
    identity = f"{patient_id}{model_name}{_feature_hash(feature_values)}{PROMPT_VERSION}"
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _make_fallback_narration(patient_name: str, risk_prob: float, contributions: list) -> str:
    factor_phrases = []
    for contribution in contributions[:3]:
        name = FEATURE_DISPLAY_NAMES.get(contribution.get("feature", "parameter"), contribution.get("feature", "parameter"))
        value = contribution.get("value", "N/A")
        direction = "elevating" if contribution.get("direction") == "increases_risk" else "mitigating"
        factor_phrases.append(f"{name} ({value}) {direction} risk")
    summary = ", ".join(factor_phrases) if factor_phrases else "available model inputs"
    return (
        f"For {patient_name}, the statistical model estimates a {risk_prob:.1%} sepsis risk driven primarily by {summary}. "
        "This research prototype output provides decision support and requires independent clinical evaluation; it is not a diagnosis."
    )


def _complete_sentences(text: str) -> list[str]:
    # Split only after terminal punctuation followed by whitespace; decimal
    # points in values such as 0.8% and 1.5 mg/dL are not sentence boundaries.
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text.strip())
        if sentence.strip() and sentence.rstrip().endswith((".", "!", "?"))
    ]


def _normalize_narration_units(text: str) -> str:
    """Normalize narrow/nonbreaking spaces and separate numbers from units."""
    normalized = text.translate({ord(char): " " for char in "\u00a0\u2007\u2009\u200a\u202f\u205f\u3000"})
    normalized = re.sub(r"[ \t]+", " ", normalized)
    units = r"(?:mmol/L|mg/dL|breaths/min|bpm|mmHg|°C|×|/min|%)"
    return re.sub(rf"(?<=\d)(?={units})", " ", normalized)


def _log_completion_diagnostics(patient_name: str, model: str, finish_reason: str, completion_tokens, empty_content: bool, latency_ms: float) -> None:
    message = (
        "Groq narration diagnostics patient=%s model=%s finish_reason=%s "
        "completion_tokens=%s empty_content=%s latency_ms=%.1f"
    )
    values = (patient_name, model, finish_reason, completion_tokens, empty_content, latency_ms)
    logger.info(message, *values)
    print(message % values, flush=True)


def _counts(client_ip: str) -> tuple[int, bool]:
    day = _utc_day()
    key = (day, client_ip)
    with _lock:
        for old_key in [stored_key for stored_key in _live_calls_by_ip if stored_key[0] != day]:
            del _live_calls_by_ip[old_key]
        for old_day in [stored_day for stored_day in _live_calls_global if stored_day != day]:
            del _live_calls_global[old_day]
        ip_count = _live_calls_by_ip.get(key, 0)
        global_count = _live_calls_global.get(day, 0)
    ip_limit = per_ip_daily_limit()
    global_limit = global_daily_limit()
    return max(0, ip_limit - ip_count), ip_count >= ip_limit or global_count >= global_limit


def narration_status(client_ip: str) -> dict:
    remaining, limit_reached = _counts(client_ip)
    return {
        "live_narrations_remaining": remaining,
        "live_narrations_limit": per_ip_daily_limit(),
        "narration_limit_reached": limit_reached,
    }


def _result(text: str, model: str, source: str, client_ip: str, generated_at: str | None = None, limit_reached: bool = False) -> dict:
    return {
        "text": text,
        "model": model,
        "source": source,
        "generated_at": generated_at,
        "live_narrations_remaining": _counts(client_ip)[0],
        "live_narrations_limit": per_ip_daily_limit(),
        "narration_limit_reached": limit_reached,
    }


def _prompt(risk_prob: float, contributions: list) -> str:
    factors = [
        {
            "feature": FEATURE_DISPLAY_NAMES.get(item.get("feature", ""), item.get("feature", "")),
            "observed_value": item.get("value"),
            "direction": item.get("direction"),
        }
        for item in contributions[:5]
    ]
    return f"""Explain this model result to a clinician in 2–3 concise sentences.
Model-estimated risk: {risk_prob:.1%}
Top model outputs (feature, observed value, direction): {json.dumps(factors, ensure_ascii=False)}
Use only the risk and feature values listed above. Do not add findings, history, advice, or facts.
Use the supplied friendly feature names. State that this estimate requires clinical evaluation and is not a diagnosis.
Return complete sentences only, under 60 words."""


def _call_groq(prompt: str, patient_name: str, model: str) -> tuple[str | None, str, str | None]:
    try:
        client = _get_client()
    except Exception as exc:
        logger.warning("Groq client initialization failed (type=%s)", type(exc).__name__)
        return None, "error", None
    if client is None:
        _log_completion_diagnostics(patient_name, model, "not_called", None, True, 0.0)
        return None, "not_configured", None

    started = time.perf_counter()
    try:
        request_options = {
            "model": model,
            "max_completion_tokens": 1200,
            "temperature": 0.1,
            "messages": [{"role": "user", "content": prompt}],
        }
        if model in {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}:
            request_options["reasoning_effort"] = "low"
            request_options["reasoning_format"] = "hidden"
        response = client.chat.completions.create(**request_options)
        latency_ms = (time.perf_counter() - started) * 1000
        choice = response.choices[0]
        text = _normalize_narration_units((choice.message.content or "").strip().strip('"').strip())
        finish_reason = choice.finish_reason or "unknown"
        usage = getattr(response, "usage", None)
        completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
        _log_completion_diagnostics(patient_name, model, finish_reason, completion_tokens, not text, latency_ms)
        sentences = _complete_sentences(text)
        if not text or len(sentences) < 2 or not text.endswith((".", "!", "?")):
            return None, finish_reason, None
        if finish_reason == "length" and not sentences:
            return None, finish_reason, None
        clean = " ".join(sentences[:3])
        if len(sentences) > 3:
            clean = " ".join(sentences[:3])
        return clean, finish_reason, datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        _log_completion_diagnostics(patient_name, model, "error", None, True, latency_ms)
        logger.warning("Groq narration error (type=%s); using cached/template fallback", type(exc).__name__)
        return None, "error", None


def _write_cache(key: str, patient_id: str, text: str, model: str, generated_at: str) -> None:
    with _lock:
        _narration_cache[key] = {
            "cache_key": key,
            "patient_id": patient_id,
            "text": text,
            "model": model,
            "generated_at": generated_at,
        }
        try:
            _persist_cache()
        except OSError as exc:
            logger.warning("Could not persist narration cache (type=%s)", type(exc).__name__)


def narrate_risk(
    patient_id: str,
    patient_name: str,
    risk_prob: float,
    contributions: list,
    feature_values: list,
    client_ip: str = "unknown",
    *,
    force_live: bool = False,
) -> dict:
    """Return a cached/live/template narration and quota status."""
    model = narration_model_name()
    key = narration_cache_key(patient_id, feature_values, model)
    if not force_live:
        with _lock:
            entry = _narration_cache.get(key)
        if entry:
            logger.info("Narration cache hit patient_id=%s key=%s", patient_id, key[:12])
            remaining, cap_reached = _counts(client_ip)
            return _result(entry["text"], entry.get("model", model), "cached", client_ip, entry.get("generated_at"), cap_reached)

        remaining, cap_reached = _counts(client_ip)
        if cap_reached:
            logger.info("Narration cap reached patient_id=%s; returning deterministic template", patient_id)
            return _result(_make_fallback_narration(patient_name, risk_prob, contributions), FALLBACK_LABEL, "template", client_ip, limit_reached=True)

    if not force_live:
        try:
            if _get_client() is None:
                _log_completion_diagnostics(patient_name, model, "not_called", None, True, 0.0)
                return _result(_make_fallback_narration(patient_name, risk_prob, contributions), FALLBACK_LABEL, "template", client_ip)
        except Exception as exc:
            logger.warning("Groq client initialization failed (type=%s); using template fallback", type(exc).__name__)
            return _result(_make_fallback_narration(patient_name, risk_prob, contributions), FALLBACK_LABEL, "template", client_ip)

    if not force_live:
        day = _utc_day()
        with _lock:
            ip_key = (day, client_ip)
            if _live_calls_by_ip.get(ip_key, 0) >= per_ip_daily_limit() or _live_calls_global.get(day, 0) >= global_daily_limit():
                return _result(_make_fallback_narration(patient_name, risk_prob, contributions), FALLBACK_LABEL, "template", client_ip, limit_reached=True)
            _live_calls_by_ip[ip_key] = _live_calls_by_ip.get(ip_key, 0) + 1
            _live_calls_global[day] = _live_calls_global.get(day, 0) + 1

    narration, finish_reason, generated_at = _call_groq(_prompt(risk_prob, contributions), patient_name, model)
    if narration:
        _write_cache(key, patient_id, narration, model, generated_at or datetime.now(timezone.utc).isoformat())
        return _result(narration, model, "live", client_ip)

    logger.info("Narration provider did not return a complete narration patient_id=%s finish_reason=%s", patient_id, finish_reason)
    return _result(_make_fallback_narration(patient_name, risk_prob, contributions), FALLBACK_LABEL, "template", client_ip)


def cached_narration_entries() -> dict[str, dict]:
    """Expose a copy for the pre-generation script and operational checks."""
    with _lock:
        return {key: dict(value) for key, value in _narration_cache.items()}
