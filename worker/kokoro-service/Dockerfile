# Kokoro TTS service — self-hosted (Hetzner/Dokploy)
FROM python:3.11-slim

# espeak-ng: fonemizador que Kokoro usa para idiomas no-ingleses (español).
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

EXPOSE 8080
# 1 worker: el modelo Kokoro vive en memoria; escalá con réplicas, no con --workers.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
