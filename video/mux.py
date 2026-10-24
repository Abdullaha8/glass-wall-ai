"""Merge the recording with the narration clips -> build/glass-wall-demo.mp4

    python video/mux.py            # needs build/raw.webm, build/timeline.json and build/audio/durations.json

Every beat plays at normal speed with its clip. The waits between beats (an agent working on a live
run, a page loading) longer than GAP_MAX_S are sped up into a short timelapse, so the video stays tight
without hiding anything.
"""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
GAP_MAX_S = 4.0     # a wait longer than this is sped up to last about this long
MAX_SPEED = 10.0
TAIL_S = 3.0        # keep the closing card on screen after the last line


def main() -> None:
    timeline = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    clips = json.loads((BUILD / "audio" / "durations.json").read_text(encoding="utf-8"))
    beats = [b["id"] for s in json.loads((HERE / "narration.json").read_text(encoding="utf-8"))["scenes"] for b in s["beats"]]

    # cut the recording into (start, end, speed) pieces: each beat at 1x, long waits sped up
    pieces, offsets, out_t = [], {}, 0.0
    cursor = max(0.0, timeline[beats[0]] - 0.6)
    for i, bid in enumerate(beats):
        start = timeline[bid]
        if start > cursor:   # the wait before this beat
            gap = start - cursor
            speed = 1.0 if gap <= GAP_MAX_S else min(MAX_SPEED, gap / GAP_MAX_S)
            pieces.append((cursor, start, speed))
            out_t += gap / speed
        offsets[bid] = out_t
        end = start + clips[bid]["seconds"] + 0.6
        if i + 1 < len(beats):
            end = min(end, timeline[beats[i + 1]])
        else:
            end += TAIL_S
        pieces.append((start, end, 1.0))
        out_t += end - start
        cursor = end

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    args = [ff, "-y", "-i", str(BUILD / "raw.webm")]
    filters = [f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{s:.4f}[v{k}]"
               for k, (a, b, s) in enumerate(pieces)]
    filters.append("".join(f"[v{k}]" for k in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[vout]")
    labels = []
    for i, bid in enumerate(beats, start=1):
        args += ["-i", str(BUILD / "audio" / clips[bid]["file"])]
        ms = int(offsets[bid] * 1000) + 150   # speak just after the box lands
        filters.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
        labels.append(f"[a{i}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0[aout]")
    out = BUILD / "glass-wall-demo.mp4"
    args += ["-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
             "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    subprocess.run(args, check=True, capture_output=True)
    sped = [(round(b - a, 1), round(s, 1)) for a, b, s in pieces if s > 1]
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB, {out_t:.0f} s); sped-up waits (seconds, speed): {sped}")


if __name__ == "__main__":
    main()
