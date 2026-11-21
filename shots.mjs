// Take the game's screenshots: serve game/ locally, open each staged scene (?shot=)
// in headless Chromium, wait until the scene is painted, and save a JPEG.
// Run: node serve.ts (in another terminal, or it starts one here) then `node shots.mjs`.
// The game is local, so no proxy is needed.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
// Playwright lives in /tmp/pwshot from an earlier install on this machine.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/tmp/pwshot/node_modules/playwright'));
}
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const PORT = 8080;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
    cwd: here,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
  server.stderr.on('data', (d) => process.stderr.write('[serve] ' + d));
  try {
    // Wait for the server to answer.
    for (let i = 0; i < 40; i += 1) {
      try {
        const res = await fetch(`http://localhost:${PORT}/index.html`);
        if (res.ok) break;
      } catch {
        // not up yet
      }
      await wait(250);
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(String(err)));
      for (const shot of shots) {
        const url = `http://localhost:${PORT}/index.html${shot.query}`;
        console.log('shot:', shot.name, url);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
        await wait(300);
        await page.screenshot({ path: join(here, 'screenshots', shot.name), type: 'jpeg', quality: 82 });
        console.log('saved screenshots/' + shot.name);
      }
      if (errors.length > 0) {
        console.error('PAGE ERRORS:');
        for (const e of errors) console.error(' -', e);
        process.exitCode = 1;
      } else {
        console.log('no page errors');
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
