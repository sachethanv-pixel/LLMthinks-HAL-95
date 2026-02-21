# Dockerfile — Full Stack (React frontend + FastAPI backend) on Cloud Run
# Stage 1: Build React frontend
FROM node:18-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --silent
COPY frontend/ ./

# Build with the production API URL pointing to same Cloud Run service
ENV REACT_APP_API_URL=https://tradesage-ai-85008682519.us-central1.run.app
RUN npm run build

# Stage 2: Python backend
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

# Copy built React app into the backend's static directory
COPY --from=frontend-builder /frontend/build /app/frontend_build

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
