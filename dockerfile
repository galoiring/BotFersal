# Use Python 3.11 slim image for ARM compatibility
FROM python:3.11-slim

# Set maintainer label
LABEL maintainer="Your Name <your.email@example.com>"

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install system dependencies for ARM architecture
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Create directory for barcode generation
RUN mkdir -p /app/temp

# Expose port (optional, for health checks)
EXPOSE 8000

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('https://api.telegram.org/bot${BOT_TOKEN}/getMe', timeout=5)" || exit 1

# Run the bot
CMD ["python", "bot_fersal.py"]