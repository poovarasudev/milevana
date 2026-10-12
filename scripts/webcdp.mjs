#!/usr/bin/env node
// Chrome DevTools Protocol driver for web verification runs — no dependencies
// (Node >= 22 built-in WebSocket + fetch). Drives a dedicated headless Chrome
// with a throwaway profile (never the user's browser session).
//
//   node scripts/webcdp.mjs launch            # start headless chrome (idempotent)
//   node scripts/webcdp.mjs nav <url>         # navigate the page target
//   node scripts/webcdp.mjs viewport <w> <h>  # set device metrics
//   node scripts/webcdp.mjs waitFor <text> [timeoutMs]  # poll until text renders
//   node scripts/webcdp.mjs click <text>      # click element containing text
//   node scripts/webcdp.mjs type <text>       # type into the focused element
//   node scripts/webcdp.mjs eval <js>         # evaluate, print JSON result
//   node scripts/webcdp.mjs shot <name>       # screenshot → docs/device-runs/$RUN_DIR
//   node scripts/webcdp.mjs console           # dump collected console messages
//   node scripts/webcdp.mjs key <key>         # key event (e.g. Enter, Escape, Backspace)
//   node scripts/webcdp.mjs offline on|off    # Network.emulateNetworkConditions
//   node scripts/webcdp.mjs seq <file>        # run a sequence file (one cmd/line)
//
// RUN_DIR env or --run-dir arg sets the screenshot directory (default
// docs/device-runs/<today>). Console messages persist in /tmp/webcdp-console.jsonl
// across invocations; `console` prints them.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { join } from 'node:path';

const CDP_PORT = 9333;
const PROFILE = '/tmp/milevana-cdp-profile';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RUN_DIR = process.env.RUN_DIR
  ?? `docs/device-runs/${new Date().toISOString().slice(0, 10)}`;
const CONSOLE_LOG = '/tmp/webcdp-console.jsonl';

const [, , cmd, ...args] = process.argv;

async function cdpTargets() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  return res.json();
}

function launch() {
  try {
    execSync(`curl -s http://127.0.0.1:${CDP_PORT}/json/version`, { stdio: 'pipe' });
    console.log('chrome already running');
    return;
  } catch { /* not running */ }
  spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=430,932', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref();
}

function connect() {
  return new Promise(async (resolve, reject) => {
    let target = (await cdpTargets()).find((t) => t.type === 'page');
    if (!target) {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      target = await res.json();
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method) listeners.forEach((f) => f(m));
    };
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res) => {
        const mid = ++id;
        pending.set(mid, res);
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
      onEvent: (f) => listeners.push(f),
      close: () => ws.close(),
    });
    ws.onerror = (e) => reject(e);
  });
}

async function evalJs(c, expr) {
  const r = await c.send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  if (r.result?.exceptionDetails) {
    return { __error: r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails) };
  }
  return r.result?.result?.value;
}

function logConsole(entry) {
  appendFileSync(CONSOLE_LOG, JSON.stringify(entry) + '\n');
}

// Persistent page-side hook (survives between CLI invocations).
const HOOK_JS = `(() => {
  if (window.__cdpHooked) return 'hooked';
  window.__cdpHooked = true;
  window.__cdpConsole = [];
  const push = (kind, text) => window.__cdpConsole.push({ t: Date.now(), kind, text: String(text).slice(0, 500) });
  for (const level of ['error', 'warn']) {
    const orig = console[level].bind(console);
    console[level] = (...a) => { push('console.' + level, a.map(String).join(' ')); return orig(...a); };
  }
  window.addEventListener('error', (e) => push('window.error', e.message + ' ' + (e.filename ?? '') + ':' + (e.lineno ?? '')));
  window.addEventListener('unhandledrejection', (e) => push('unhandledrejection', e.reason?.stack ?? e.reason));
  return 'installed';
})()`;

async function attachConsole(c) {
  await c.send('Runtime.enable');
  await c.send('Log.enable');
  c.onEvent((m) => {
    if (m.method === 'Runtime.consoleAPICalled') {
      const args2 = (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
      logConsole({ t: Date.now(), kind: `console.${m.params.type}`, text: args2.slice(0, 500) });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      logConsole({ t: Date.now(), kind: `log.${e.level}`, text: `${e.text} ${e.url ?? ''}`.slice(0, 500) });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logConsole({ t: Date.now(), kind: 'exception', text: (d.exception?.description ?? d.text ?? '').slice(0, 500) });
    }
  });
}

const CLICK_JS = (text) => `(() => {
  const needle = ${JSON.stringify(text)};
  const els = [...document.querySelectorAll('body *')].filter(
    (e) => e.children.length === 0 || e.childElementCount <= 2);
  let el = els.find((e) => (e.textContent ?? '').trim() === needle)
        ?? els.find((e) => (e.textContent ?? '').includes(needle));
  if (!el) return 'NOTFOUND';
  let n = el;
  while (n && !n.getAttribute('role') && n.tagName !== 'A' && n.tagName !== 'BUTTON'
         && getComputedStyle(n).cursor !== 'pointer' && !n.onclick) n = n.parentElement;
  (n ?? el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return 'clicked:' + el.tagName + ':' + el.textContent.trim().slice(0, 40);
})()`;

const VISIBLE_JS = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;

async function run(c, argv) {
  const [action, ...rest] = argv;
  switch (action) {
    case 'nav': {
      await c.send('Page.enable');
      await c.send('Page.navigate', { url: rest[0] });
      return 'navigated';
    }
    case 'viewport': {
      const [w, h] = rest.map(Number);
      await c.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 1, mobile: w < 768,
      });
      return `viewport ${w}x${h}`;
    }
    case 'waitFor': {
      const timeout = Number(rest[1] ?? 15000);
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await evalJs(c, VISIBLE_JS(rest[0]))) return 'visible';
        await new Promise((r) => setTimeout(r, 400));
      }
      return 'TIMEOUT waiting for: ' + rest[0];
    }
    case 'waitForGone': {
      const timeout = Number(rest[1] ?? 15000);
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (!(await evalJs(c, VISIBLE_JS(rest[0])))) return 'gone';
        await new Promise((r) => setTimeout(r, 400));
      }
      return 'TIMEOUT still visible: ' + rest[0];
    }
    case 'click': {
      return evalJs(c, CLICK_JS(rest[0]));
    }
    case 'type': {
      await c.send('Input.insertText', { text: rest.join(' ') });
      return 'typed';
    }
    case 'key': {
      const keyMap = { Enter: { code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }, Escape: { code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 }, Backspace: { code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 }, Tab: { code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 } };
      const k = keyMap[rest[0]] ?? { code: rest[0], key: rest[0], windowsVirtualKeyCode: 0 };
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
      return 'key:' + rest[0];
    }
    case 'eval': {
      const out = await evalJs(c, rest.join(' '));
      return typeof out === 'object' ? JSON.stringify(out) : String(out);
    }
    case 'shot': {
      mkdirSync(RUN_DIR, { recursive: true });
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      const file = join(RUN_DIR, `${rest[0]}.png`);
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    }
    case 'console': {
      if (existsSync(CONSOLE_LOG)) process.stdout.write(readFileSync(CONSOLE_LOG, 'utf8'));
      const page = await evalJs(c, 'JSON.stringify(window.__cdpConsole ?? [])');
      for (const e of JSON.parse(page ?? '[]')) console.log(JSON.stringify(e));
      return '';
    }
    case 'clearconsole': {
      writeFileSync(CONSOLE_LOG, '');
      return 'cleared';
    }
    case 'offline': {
      await c.send('Network.enable');
      await c.send('Network.emulateNetworkConditions', rest[0] === 'on'
        ? { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
        : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      return 'offline:' + rest[0];
    }
    case 'sleep': {
      await new Promise((r) => setTimeout(r, Number(rest[0])));
      return 'slept';
    }
    case 'seq': {
      const lines = readFileSync(rest[0], 'utf8').split('\n')
        .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      for (const line of lines) {
        const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g).map((p) => p.replace(/^"|"$/g, ''));
        const out = await run(c, parts);
        console.log(`$ ${line}\n  → ${out}`);
      }
      return 'done';
    }
    default:
      return 'unknown command';
  }
}

const isMain = cmd !== undefined;
if (isMain) {
  if (cmd === 'launch') launch();
  else {
    const c = await connect();
    await attachConsole(c);
    await evalJs(c, HOOK_JS);
    const out = await run(c, [cmd, ...args]);
    if (out) console.log(out);
    c.close();
  }
}
