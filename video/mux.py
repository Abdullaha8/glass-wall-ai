"""Merge the recording with the narration clips at their scene offsets -> build/glass-wall-demo.mp4

    python video/mux.py
"""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"


def main() -> None:
    timeline = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    scenes = [s["id"] for s in json.loads((HERE / "narration.json").read_text(encoding="utf-8"))["scenes"]]
    head = max(0.0, timeline[scenes[0]] - 0.2)  # drop the page-load before the intro card
    args = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-ss", f"{head:.2f}", "-i", str(BUILD / "raw.webm")]
    filters, labels = [], []
    for i, sid in enumerate(scenes, start=1):
        args += ["-i", str(BUILD / "audio" / f"{sid}.mp3")]
        ms = int((timeline[sid] - head) * 1000) + 300  # small lead-in after the visual cut
        filters.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
        labels.append(f"[a{i}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0[aout]")
    out = BUILD / "glass-wall-demo.mp4"
    args += ["-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[aout]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
             "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    subprocess.run(args, check=True, capture_output=True)
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
