# Dockerfile for TradeSage AI Cloud Run Deployment — Optimized for latency
FROM python:3.11.2-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .

# Install Python dependencies with fast parallel resolver
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment
ENV PYTHONPATH=/app
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
# Disable Python startup overhead
ENV PYTHONDONTWRITEBYTECODE=1
# Disable tokenizer parallelism warnings
ENV TOKENIZERS_PARALLELISM=false

# Non-root user
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use 4 workers (matches 4-CPU Cloud Run config), with optimized timeouts
CMD ["uvicorn", "app.adk.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8080", \
    "--workers", "4", \
    "--timeout-keep-alive", "300", \
    "--loop", "uvloop", \
    "--http", "httptools"]
