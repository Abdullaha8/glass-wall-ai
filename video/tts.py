"""Generate one narration clip per beat with ElevenLabs (key from .env).

    python video/tts.py            # only generates clips whose text or voice changed

Each clip's file name carries a hash of its text, voice and model, so editing a line or switching
voices regenerates just what changed. Durations go to build/audio/durations.json, keyed by beat id.
"""
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

import httpx
import imageio_ffmpeg
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
OUT = HERE / "build" / "audio"
MODEL_ID = "eleven_v4"


def duration_s(path: Path) -> float:
    proc = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(path)], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", proc.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def beats(spec: dict) -> list[dict]:
    return [b for scene in spec["scenes"] for b in scene["beats"]]


def clip_path(beat: dict, voice_id: str) -> Path:
    digest = hashlib.sha256(f"{voice_id}|{MODEL_ID}|{beat['text']}".encode()).hexdigest()[:8]
    return OUT / f"{beat['id']}-{digest}.mp3"


def main() -> None:
    spec = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    headers = {"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}
    durations = {}
    for beat in beats(spec):
        path = clip_path(beat, spec["voice_id"])
        if not path.exists():
            r = httpx.post(f"https://api.elevenlabs.io/v1/text-to-speech/{spec['voice_id']}",
                           params={"output_format": "mp3_44100_128"}, headers=headers, timeout=120,
                           json={"text": beat["text"], "model_id": MODEL_ID,
                                 "voice_settings": {"stability": 0.55, "similarity_boost": 0.75}})
            if r.status_code != 200:
                raise SystemExit(f"{beat['id']}: {r.status_code} {r.text[:300]}")
            path.write_bytes(r.content)
        durations[beat["id"]] = {"file": path.name, "seconds": round(duration_s(path), 2)}
        print(f"{beat['id']:<16} {durations[beat['id']]['seconds']:>6.2f}s")
    (OUT / "durations.json").write_text(json.dumps(durations, indent=2), encoding="utf-8")
    print(f"total speech {sum(d['seconds'] for d in durations.values()):.1f}s")


if __name__ == "__main__":
    main()
