# Use multi-stage build for better caching
FROM node:18-alpine AS frontend-build

# Set working directory for frontend
WORKDIR /app/frontend

# Copy package files first for better caching
COPY frontend/package*.json ./

# Install dependencies (this layer will be cached if package.json doesn't change)
RUN npm ci --only=production --silent

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Python backend stage
FROM python:3.11-slim AS backend

LABEL Maintainer="Gal"
WORKDIR /app
ENV PYTHONPATH=/app

# Install system dependencies in a single layer and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Copy and install Python dependencies first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --no-compile -r requirements.txt \
    && pip cache purge

# Copy backend code
COPY backend/ ./

# Copy React build from frontend stage
COPY --from=frontend-build /app/frontend/build ./build

# Create necessary directories
RUN mkdir -p logs temp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]