# Stage 1 — build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY web/frontend/package.json web/frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps
COPY web/frontend .
RUN npm run build

# Stage 2 — Python app
FROM python:3.11-slim
WORKDIR /app

# Install deps
COPY pyproject.toml setup.py ./
COPY builder/ ./builder/
COPY spec/ ./spec/
RUN pip install --no-cache-dir -e .

COPY web/pyproject.toml ./web/
COPY web/backend/ ./web/backend/
COPY web/alembic.ini ./web/
RUN pip install --no-cache-dir -e ./web

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./web/static

# Data directory
RUN mkdir -p /app/web/data

ENV DATABASE_URL=sqlite:////app/web/data/company-brain.db

EXPOSE 8000
WORKDIR /app/web
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
