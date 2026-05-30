FROM python:3.11-slim

WORKDIR /app

# Install builder package from repo root so `import builder` works without sys.path hacks
COPY pyproject.toml .
COPY builder/ ./builder/
RUN pip install --no-cache-dir -e .

# Install web backend + runtime deps
WORKDIR /app/web
COPY web/pyproject.toml .
RUN pip install --no-cache-dir -e ".[runtime]"

# Copy remaining source (spec templates + full web tree)
WORKDIR /app
COPY spec/ ./spec/
COPY web/ ./web/

WORKDIR /app/web
EXPOSE 8000
