// Azura Bay — shot renderer. Serves game/ locally, opens each ?shot=
// scene in headless Chrome over CDP, waits for the staged frame to be
// ready, and captures a 1280x720 JPEG into screenshots/.
//
//   node shoot.mjs [--port 8901] [--out screenshots]
// Chrome: the Playwright-bundled build on this machine, SwiftShader GL.

import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('./', import.meta.url));
const root = join(here, 'game');
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx === -1 ? 8901 : Number(args[portIdx + 1]);
const outIdx = args.indexOf('--out');
const outDir = outIdx === -1 ? join(here, 'screenshots') : resolve(args[outIdx + 1]);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx === -1 ? null : args[onlyIdx + 1];

const CHROME = process.env.CHROME_BIN || (process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': data.length });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('no response from ' + url);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    };
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    return r.result ? r.result.value : undefined;
  }
}

const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).filter((s) => !only || s.name.startsWith(only));

async function main() {
  await new Promise((res) => server.listen(port, '127.0.0.1', res));
  console.log('serving game/ on http://localhost:' + port);
  mkdirSync(outDir, { recursive: true });

  const dbgPort = 9333;
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1280,720',
    '--force-device-scale-factor=1',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + dbgPort,
    '--user-data-dir=/tmp/azura-chrome-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const targets = await getJson('http://127.0.0.1:' + dbgPort + '/json/list');
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    for (const shot of shots) {
      const url = 'http://localhost:' + port + '/' + shot.query;
      console.log('shot ' + shot.name + ' <- ' + url);
      await cdp.send('Page.navigate', { url });
      // wait for the staged frame
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        try {
          ready = await cdp.eval('window.__SHOT_READY__ === true');
        } catch { ready = false; }
        if (ready) break;
        const err = await cdp.eval('window.__SHOT_ERROR__ || null');
        if (err) throw new Error('page error in ' + shot.name + ': ' + err);
      }
      if (!ready) throw new Error('shot never became ready: ' + shot.name);
      await sleep(1200); // let the frame settle (light flashes, particles)
      const shot2 = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      const out = join(outDir, shot.name);
      writeFileSync(out, Buffer.from(shot2.data, 'base64'));
      const kb = Math.round(statSync(out).size / 1024);
      console.log('wrote ' + out + ' (' + kb + ' KiB)');
      if (kb > 256) console.log('WARNING: over the 256 KiB gate limit');
    }
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
