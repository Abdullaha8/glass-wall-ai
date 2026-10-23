#!/usr/bin/env bash
# Resume an eval batch until nothing is left, waiting out free-tier quotas.
#   scripts/eval_until_done.sh <batch> <model> [extra eval args...]
# Example: scripts/eval_until_done.sh b2 groq/openai/gpt-oss-120b --cases attacks --trials 3
set -u
cd "$(dirname "$0")/../python"
PY=../.venv/Scripts/python.exe; [ -x "$PY" ] || PY=../.venv/bin/python
batch=$1; model=$2; shift 2

for attempt in $(seq 1 60); do
  out=$(PYTHONIOENCODING=utf-8 "$PY" -u -m glasswall.eval --batch "$batch" --models "$model" "$@" 2>&1 | tee /dev/stderr)
  if grep -q "^batch $batch: 0 runs to do" <<<"$out"; then
    echo "COMPLETE $batch $model"
    exit 0
  fi
  echo "WAITING $batch $model: attempt $attempt left runs undone; retrying in 10 min"
  sleep 600
done
echo "GAVE UP $batch $model after 60 attempts"
exit 1
