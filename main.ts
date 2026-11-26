// Storm Runner — the hand-in program for make.fun (Node 22, standard
// library only). The game itself is plain static files under game/ (a
// desktop browser opens game/index.html and plays it offline), and the
// screenshots of it live in screenshots/ (the first by name is the cover).
// This program gathers both into /output and writes /output/dossier.json,
// the summary the judge reads, using the vendored make.fun library.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game itself with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (see the kit's gate): the text
// budget shapes the dossier, and the rest refuse an entry the scorer
// would refuse anyway (too many or too large screenshots, too much game).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
