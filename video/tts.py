"""Generate one narration clip per scene with ElevenLabs (key from .env).

    python video/tts.py            # skips clips that already exist
"""
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


def duration_s(path: Path) -> float:
    proc = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(path)], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", proc.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def main() -> None:
    spec = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    headers = {"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}
    durations = {}
    for scene in spec["scenes"]:
        path = OUT / f"{scene['id']}.mp3"
        if not path.exists():
            r = httpx.post(f"https://api.elevenlabs.io/v1/text-to-speech/{spec['voice_id']}",
                           params={"output_format": "mp3_44100_128"}, headers=headers, timeout=120,
                           json={"text": scene["text"], "model_id": "eleven_multilingual_v2",
                                 "voice_settings": {"stability": 0.55, "similarity_boost": 0.75}})
            if r.status_code != 200:
                raise SystemExit(f"{scene['id']}: {r.status_code} {r.text[:300]}")
            path.write_bytes(r.content)
        durations[scene["id"]] = round(duration_s(path), 2)
        print(f"{scene['id']:<16} {durations[scene['id']]:>6.2f}s")
    (OUT / "durations.json").write_text(json.dumps(durations, indent=2), encoding="utf-8")
    print(f"total {sum(durations.values()):.1f}s")


if __name__ == "__main__":
    main()
