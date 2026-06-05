# ── Stage 1: build the React frontend ──────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web/frontend
COPY web/frontend/package*.json ./
RUN npm ci --silent
COPY web/frontend/ ./
RUN npm run build
# Vite outDir "../static" → output lands at /app/web/static/

# ── Stage 2: Python backend ─────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY builder/ ./builder/
RUN pip install --no-cache-dir -e .

WORKDIR /app/web
COPY web/pyproject.toml .
RUN pip install --no-cache-dir -e ".[runtime]"

WORKDIR /app
COPY spec/ ./spec/
COPY web/ ./web/

COPY --from=frontend-builder /app/web/static/ /app/web/static/

WORKDIR /app/web
EXPOSE 8000
