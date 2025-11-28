# backend/chatbot/Dockerfile
FROM python:3.10-slim

# Do not write .pyc files and always flush stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (build tools only; remove apt lists to keep image small)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# The Flask app listens on 8070
EXPOSE 8070

# Default command
CMD ["python", "app.py"]
