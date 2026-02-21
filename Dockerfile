# Dockerfile — Full Stack (pre-built React + FastAPI) on Cloud Run
# React is built locally before pushing. Docker just copies the build output.

FROM python:3.11.2-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Copy pre-built React app into the static serving location
# (build/ is committed to git so Docker can simply copy it)
RUN if [ -d "frontend/build" ]; then \
    cp -r frontend/build frontend_build; \
    echo "Frontend build found and copied"; \
    else \
    echo "WARNING: frontend/build not found — API-only mode"; \
    fi

ENV PYTHONPATH=/app
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TOKENIZERS_PARALLELISM=false

RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["uvicorn", "app.adk.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8080", \
    "--workers", "4", \
    "--timeout-keep-alive", "300", \
    "--loop", "uvloop", \
    "--http", "httptools"]
