// Solmar City — a working gta6-01 entry (Node 22, standard library only): a complete
// open-world crime game in the spirit of GTA, in 2D top-down canvas. The game is this
// directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library, no network request, WebAudio sound
// synthesised in code). You are Mara Solis, a courier driver in the coastal city of
// Solmar, taking jobs from the fixer Dario: a fare, a package run, a police chase and one
// big score. The city is free to explore on foot and by car, with traffic and
// pedestrians, cars to steal, a wanted level with police who chase and arrest you, combat
// (pistol and melee), a HUD with a minimap, a start screen and a localStorage save.
//
// This program hands the game in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. The screenshots are real renders of the game itself, staged
// with ?shot=start|drive|chase|mission (see game/src/shots.js and shots.mjs).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// A submission with no screenshots is a broken one: refuse to write a dossier for it.
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`Solmar City needs 3 or 4 screenshots, found ${shotFiles.length}`);
}
console.log(`Solmar City: ${shotFiles.length} screenshots, game/ copied to ${out}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
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
