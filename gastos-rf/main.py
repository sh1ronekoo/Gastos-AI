"""
main.py
───────
FastAPI microservice for Random Forest expense categorization.
Sits between the TS keyword classifier and Claude in the fallback chain.

Endpoints:
    POST /categorize        → single expense
    POST /categorize/batch  → bulk classify (for importing existing expenses)
    GET  /health            → readiness check
    POST /retrain           → re-train with new labeled data (admin)

Start:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from categorizer import classify, classify_batch, _load_model, CATEGORIES, RF_THRESHOLD

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Lifespan: pre-warm model on startup ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Pre-warming Random Forest model…")
    try:
        _load_model()
        logger.info("Model loaded successfully.")
    except FileNotFoundError as e:
        logger.warning(f"Model not found on startup: {e}. Run `python train.py`.")
    yield
    logger.info("Shutting down Gastos RF service.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Gastos AI — Random Forest Categorizer",
    description="ML microservice for expense categorization (Gastos PH)",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS: allow Next.js dev + prod origins ────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://your-gastos-app.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Optional API key guard ────────────────────────────────────────────────────
RF_API_KEY = os.getenv("RF_API_KEY", "")   # set in .env.local; leave blank to disable

def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    if RF_API_KEY and x_api_key != RF_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid RF_API_KEY")
    return True


# ── Request / Response schemas ────────────────────────────────────────────────
class CategorizeRequest(BaseModel):
    title:        str = Field(..., min_length=1, description="Expense title")
    merchantName: str = Field("", description="Merchant name (optional but recommended)")

class CategorizeResponse(BaseModel):
    category:   str
    confidence: float
    source:     str = "rf"
    allScores:  dict[str, float]
    aboveThreshold: bool

class BatchItem(BaseModel):
    title:        str
    merchantName: str = ""

class BatchRequest(BaseModel):
    items: list[BatchItem] = Field(..., min_length=1, max_length=500)

class BatchResponse(BaseModel):
    results: list[CategorizeResponse]
    count:   int

class RetrainRequest(BaseModel):
    samples: list[dict] = Field(..., description="[{text: str, category: str}, ...]")

class HealthResponse(BaseModel):
    status:      str
    modelLoaded: bool
    categories:  list[str]
    threshold:   float


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    """Readiness probe — call this from Next.js before trusting RF results."""
    try:
        _load_model()
        model_loaded = True
    except Exception:
        model_loaded = False
    return {
        "status":      "ok" if model_loaded else "model_missing",
        "modelLoaded": model_loaded,
        "categories":  CATEGORIES,
        "threshold":   RF_THRESHOLD,
    }


@app.post("/categorize", response_model=CategorizeResponse, tags=["categorize"])
def categorize_single(
    req: CategorizeRequest,
    _auth: bool = Depends(verify_api_key),
):
    """
    Classify a single expense.

    Returns the same shape as the TS /api/categorize route so
    Next.js route.ts can call it transparently as a middle tier.
    """
    if not req.title.strip() and not req.merchantName.strip():
        raise HTTPException(status_code=400, detail="title or merchantName is required")

    try:
        result = classify(req.title, req.merchantName)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"classify() error: {e}")
        raise HTTPException(status_code=500, detail="Categorization failed")

    return {
        **result,
        "aboveThreshold": result["confidence"] >= RF_THRESHOLD,
    }


@app.post("/categorize/batch", response_model=BatchResponse, tags=["categorize"])
def categorize_batch(
    req: BatchRequest,
    _auth: bool = Depends(verify_api_key),
):
    """
    Bulk classify up to 500 expenses in one shot.
    Useful for retroactively tagging existing expenses after model deployment.
    """
    items = [{"title": i.title, "merchantName": i.merchantName} for i in req.items]
    try:
        results = classify_batch(items)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"classify_batch() error: {e}")
        raise HTTPException(status_code=500, detail="Batch categorization failed")

    enriched = [{**r, "aboveThreshold": r["confidence"] >= RF_THRESHOLD} for r in results]
    return {"results": enriched, "count": len(enriched)}


@app.post("/retrain", tags=["admin"])
def retrain(
    req: RetrainRequest,
    _auth: bool = Depends(verify_api_key),
):
    """
    Append new labeled samples and retrain the model in-place.
    Call this after collecting enough user-correction data from Supabase.

    Body: { samples: [{ "text": "jollibee lunch", "category": "Food" }, ...] }
    """
    import subprocess
    import sys

    valid = [s for s in req.samples if s.get("category") in CATEGORIES and s.get("text")]
    if not valid:
        raise HTTPException(status_code=400, detail="No valid samples provided")

    # Append to the supplementary training file
    supp_path = "data/supplementary.jsonl"
    os.makedirs("data", exist_ok=True)
    with open(supp_path, "a") as f:
        for sample in valid:
            f.write(json.dumps({"text": sample["text"], "category": sample["category"]}) + "\n")

    logger.info(f"Appended {len(valid)} samples to {supp_path}")

    # Kick off a background retrain
    try:
        result = subprocess.run(
            [sys.executable, "train.py"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            logger.error(f"Retrain failed: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Retrain failed: {result.stderr[-500:]}")

        # Invalidate the in-memory model so next request reloads from disk
        import categorizer
        categorizer._pipeline = None

        return {
            "status":        "retrained",
            "samplesAdded":  len(valid),
            "trainOutput":   result.stdout[-1000:],  # last 1000 chars of stdout
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Retrain timed out (>120s)")