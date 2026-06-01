"""
categorizer.py
──────────────
Loads the trained Random Forest pipeline and exposes a classify() function
that mirrors the TypeScript classify() interface exactly.

Returns:
    {
        "category":   str,           # "Food" | "Transport" | ... | "Other"
        "confidence": float,         # 0.0–1.0 (highest class probability)
        "source":     "rf",          # always "rf" from this module
        "allScores":  dict[str, float]  # probability per category
    }
"""

import os
import json
import joblib
import numpy as np
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_DIR  = Path(__file__).parent / "model"
MODEL_PATH = MODEL_DIR / "rf_categorizer.joblib"
META_PATH  = MODEL_DIR / "categories.json"

# Must match TypeScript ExpenseCategory exactly (casing included)
CATEGORIES = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"]

# Confidence threshold — same as ML_THRESHOLD in ml-categorizer.ts
RF_THRESHOLD = 0.52

# ── Singleton model loader ────────────────────────────────────────────────────
_pipeline = None


def _load_model():
    global _pipeline
    if _pipeline is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Run `python train.py` first."
            )
        _pipeline = joblib.load(MODEL_PATH)
    return _pipeline


# ── Text pre-processor (mirrors normalise() in ml-categorizer.ts) ─────────────
def _combine_inputs(title: str, merchant_name: str = "") -> str:
    """
    Combine title + merchant_name into a single string for the TF-IDF vectorizer.
    Merchant name is repeated to give it extra weight (mirrors the 1.4× factor
    in the TS classifier).
    """
    title_clean    = title.strip().lower()
    merchant_clean = merchant_name.strip().lower()

    if merchant_clean:
        # Repeat merchant tokens to simulate the 1.4× weighting
        return f"{title_clean} {merchant_clean} {merchant_clean}"
    return title_clean


# ── Public classify() ─────────────────────────────────────────────────────────
def classify(title: str, merchant_name: str = "") -> dict:
    """
    Classify an expense and return a dict matching the TS CategorizationResult.

    Args:
        title:         Expense title string.
        merchant_name: Optional merchant name (stronger signal).

    Returns:
        {
            "category":   str,
            "confidence": float,
            "source":     "rf",
            "allScores":  { "Food": float, ... }
        }
    """
    if not title.strip() and not merchant_name.strip():
        return {
            "category":  "Other",
            "confidence": 0.0,
            "source":    "rf",
            "allScores": {c: 1/6 for c in CATEGORIES},
        }

    pipeline = _load_model()
    combined = _combine_inputs(title, merchant_name)

    # predict_proba returns shape (1, n_classes)
    proba   = pipeline.predict_proba([combined])[0]
    classes = pipeline.classes_            # order may differ from CATEGORIES

    # Build allScores dict in canonical order
    proba_map = {cls: float(prob) for cls, prob in zip(classes, proba)}
    all_scores = {cat: proba_map.get(cat, 0.0) for cat in CATEGORIES}

    best_cat  = max(all_scores, key=all_scores.__getitem__)
    best_conf = all_scores[best_cat]

    return {
        "category":  best_cat if best_conf >= RF_THRESHOLD else "Other",
        "confidence": round(best_conf, 4),
        "source":    "rf",
        "allScores": {k: round(v, 4) for k, v in all_scores.items()},
    }


# ── Convenience: batch classify ──────────────────────────────────────────────
def classify_batch(items: list[dict]) -> list[dict]:
    """
    Classify a list of { title, merchantName } dicts in a single vectorizer pass.
    Much faster than calling classify() in a loop for bulk re-training imports.
    """
    if not items:
        return []

    pipeline = _load_model()
    texts    = [_combine_inputs(i.get("title", ""), i.get("merchantName", "")) for i in items]
    probas   = pipeline.predict_proba(texts)
    classes  = pipeline.classes_

    results = []
    for proba in probas:
        proba_map  = {cls: float(p) for cls, p in zip(classes, proba)}
        all_scores = {cat: proba_map.get(cat, 0.0) for cat in CATEGORIES}
        best_cat   = max(all_scores, key=all_scores.__getitem__)
        best_conf  = all_scores[best_cat]
        results.append({
            "category":  best_cat if best_conf >= RF_THRESHOLD else "Other",
            "confidence": round(best_conf, 4),
            "source":    "rf",
            "allScores": {k: round(v, 4) for k, v in all_scores.items()},
        })
    return results