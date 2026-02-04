FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for Pillow
RUN apt-get update && apt-get install -y \
    libfreetype6-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY python/api-python/requirements.txt ./python/api-python/
COPY python/workflow-python/requirements.txt ./python/workflow-python/

RUN pip install --no-cache-dir -r ./python/api-python/requirements.txt
RUN pip install --no-cache-dir -r ./python/workflow-python/requirements.txt

# Copy source code
COPY python ./python
COPY shared ./shared

WORKDIR /app/python/api-python

# Run the API
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
