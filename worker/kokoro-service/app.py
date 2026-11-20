"""
Microservicio Kokoro TTS (self-hosted en Hetzner).

POST /tts {text, voice, lang} -> WAV (24kHz). El worker de WhatsApp lo llama y
transcodifica a OGG/Opus para enviar la nota de voz. Voz por defecto: ef_dora (es).

Correr local:  uvicorn app:app --host 0.0.0.0 --port 8080
"""
import io
import os

import numpy as np
import soundfile as sf
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from kokoro import KPipeline

app = FastAPI(title="kokoro-tts")
TOKEN = os.environ.get("KOKORO_TOKEN")  # opcional: protege el endpoint

_pipes: dict[str, KPipeline] = {}


def _pipe(lang: str) -> KPipeline:
    if lang not in _pipes:
        _pipes[lang] = KPipeline(lang_code=lang)  # 'e' = español
    return _pipes[lang]


class TTSReq(BaseModel):
    text: str
    voice: str = "ef_dora"
    lang: str = "e"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/tts")
def tts(req: TTSReq, authorization: str | None = Header(default=None)):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "no autorizado")
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "text vacío")

    chunks = [audio for _, _, audio in _pipe(req.lang)(text, voice=req.voice)]
    if not chunks:
        raise HTTPException(500, "Kokoro no produjo audio")

    wav = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, wav, 24000, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")
