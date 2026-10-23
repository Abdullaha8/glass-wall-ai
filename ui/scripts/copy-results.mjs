// Copy the committed eval results into public/ so Replay mode works with no backend.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "results");
const dest = join(here, "..", "public", "results");
mkdirSync(dest, { recursive: true });

for (const name of ["latest.json", "events_sample.jsonl", "outbox_sample.json"]) {
  if (existsSync(join(src, name))) {
    copyFileSync(join(src, name), join(dest, name));
    console.log(`copied results/${name}`);
  } else {
    console.warn(`missing results/${name} (run python -m glasswall.export)`);
  }
}
