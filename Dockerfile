FROM python:3.11-slim-bookworm

WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip

# Copy the rest of the application
COPY . .

# Install dependencies
RUN pip install --no-cache-dir .

# Install playwright system dependencies
RUN playwright install chromium --with-deps

EXPOSE 8000
CMD ["gunicorn", "hireflow.api:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
