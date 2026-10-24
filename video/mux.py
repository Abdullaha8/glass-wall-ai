"""Merge the recording with the narration clips at their beat offsets -> build/glass-wall-demo.mp4

    python video/mux.py            # needs build/raw.webm, build/timeline.json and build/audio/durations.json
"""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"


def main() -> None:
    timeline = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    clips = json.loads((BUILD / "audio" / "durations.json").read_text(encoding="utf-8"))
    beats = [b["id"] for s in json.loads((HERE / "narration.json").read_text(encoding="utf-8"))["scenes"] for b in s["beats"]]
    head = max(0.0, timeline[beats[0]] - 0.6)   # drop the page load before the first beat
    args = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-ss", f"{head:.2f}", "-i", str(BUILD / "raw.webm")]
    filters, labels = [], []
    for i, bid in enumerate(beats, start=1):
        args += ["-i", str(BUILD / "audio" / clips[bid]["file"])]
        ms = int((timeline[bid] - head) * 1000) + 150   # speak just after the box lands
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
