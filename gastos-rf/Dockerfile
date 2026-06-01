# ── Gastos RF Microservice — Dockerfile ──────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY train.py categorizer.py main.py ./

# Train the model at build time so the container starts warm
RUN python train.py

# Expose FastAPI port
EXPOSE 10000

# Start with uvicorn (1 worker for small deploy; scale with --workers N)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]