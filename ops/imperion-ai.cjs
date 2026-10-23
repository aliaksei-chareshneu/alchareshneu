'use strict';
/**
 * IMPERION on-device AI launcher.
 * No automatic install, login bypass, paid API, remote model, CRM mutation or publication.
 * An optional Qwen3 4B download requires a separate typed INSTALL confirmation.
 * Status probes only installed CLIs and Ollama on literal 127.0.0.1:11434.
 * Interactive provider clients start ONLY when selected by a human.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');

const ROOT = path.resolve(__dirname, '..');
const LOOPBACK = 'http://127.0.0.1:11434';
const ALLOWED_MODELS = Object.freeze(['qwen3:4b', 'qwen3:0.6b']);
const ACTIONS = Object.freeze(['help', 'status', 'test', 'preview', 'smoke', 'editor', 'codex', 'agy', 'chat', 'setup-model']);

function findCommand(name, settings = {}) {
  const platform = settings.platform || process.platform;
  const env = settings.env || process.env;
  const local = env.LOCALAPPDATA || '';
  const extra = platform === 'win32' && local ? ({
    agy: [path.join(local, 'agy', 'bin', 'agy.exe')],
    codex: [path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')],
    ollama: [path.join(local, 'Programs', 'Ollama', 'ollama.exe')],
  })[name] || [] : [];
  for (const candidate of extra) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const resolver = platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(resolver, [name], {
    encoding: 'utf8', timeout: 1800, windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return null;
  return result.stdout.trim().split(/\r?\n/)[0] || null;
}

function selectLocalModel(ids) {
  if (!Array.isArray(ids)) return null;
  return ALLOWED_MODELS.find(model => ids.includes(model)) || null;
}

async function readLocalModels(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(LOOPBACK + '/api/tags', {
    method: 'GET', signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw Error('OLLAMA_NOT_READY');
  const data = await response.json();
  if (!Array.isArray(data?.models)) throw Error('OLLAMA_INVALID_MODEL_LIST');
  const ids = data.models.map(item => item?.name).filter(item => typeof item === 'string');
  return { ids, selected: selectLocalModel(ids) };
}

function runLocalProcess(bin, args, options = {}) {
  if (!bin) throw Error('REQUIRED_COMMAND_NOT_INSTALLED');
  const child = spawnSync(bin, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32' && /\.cmd$/i.test(bin),
    windowsHide: false,
    timeout: options.timeout || undefined,
  });
  if (child.error) throw child.error;
  return typeof child.status === 'number' ? child.status : 1;
}

function printHelp() {
  console.log([
    'IMPERION AI — local launcher (Windows: double-click ops\\IMPERION-AI.cmd)',
    'node ops/imperion-ai.cjs status   | Installed tools + localhost model (read only)',
    'node ops/imperion-ai.cjs test     | Safe local tests (no cloud calls)',
    'node ops/imperion-ai.cjs preview  | Synthetic public fixture; zero network',
    'node ops/imperion-ai.cjs smoke    | Real localhost synthetic multilingual QA',
    'node ops/imperion-ai.cjs editor   | Open this repository in VS Code',
    'node ops/imperion-ai.cjs codex    | Interactive Codex in read-only sandbox',
    'node ops/imperion-ai.cjs agy      | Interactive Antigravity, sandbox+plan only',
    'node ops/imperion-ai.cjs chat     | Interactive local CPU-only Qwen, no logs',
    'node ops/imperion-ai.cjs setup-model | Explicit opt-in download of Qwen3 4B (~2.5 GB)',
    'None of these commands posts, emails, edits a CRM, installs software, or subscribes.',
    'Important: smoke may exit 2 = QA_BLOCKED; that means unsafe drafts were rejected.',
  ].join('\n'));
}

async function showStatus(settings = {}) {
  const output = settings.output || console.log;
  output('REPOSITORY: ' + ROOT);
  for (const name of ['git', 'code', 'codex', 'agy', 'ollama']) {
    output(name + ': ' + (findCommand(name, settings) ? 'INSTALLED (auth/quota not implied)' : 'NOT FOUND'));
  }
  try {
    const { ids, selected } = await readLocalModels(settings.fetchImpl || globalThis.fetch);
    output('Ollama localhost: ONLINE');
    output('Allowed local models: ' + (ids.filter(x => ALLOWED_MODELS.includes(x)).join(', ') || 'NONE'));
    output('Preferred for synthetic QA: ' + (selected || 'NONE — no auto-download'));
    if (selected === 'qwen3:0.6b') output('QUALITY WARNING: 0.6B has failed real localization checks.');
  } catch {
    output('Ollama localhost: OFFLINE OR NOT VERIFIED; no cloud fallback');
  }
  output('VS Code Copilot: check "Use AI Features" sign-in and account quota in UI.');
  output('Codex: installed binary does not prove an actual completed agent task.');
  output('Antigravity: Google account eligibility must be confirmed interactively.');
  output('Microsoft 365/Copilot: license and Graph permissions require tenant admin.');
  output('No user account, billing or production change performed.');
}

async function localChat(settings = {}) {
  const fetchImpl = settings.fetchImpl || globalThis.fetch;
  const { selected } = await readLocalModels(fetchImpl);
  if (!selected) throw Error('NO_ALLOWED_LOCAL_MODEL; nothing downloaded');
  const rl = readline.createInterface({
    input: settings.input || process.stdin,
    output: settings.output || process.stdout,
  });
  console.log('LOCAL CHAT — ' + selected + ' | CPU-only | each prompt independent | /exit quits');
  console.log('Small models may be inaccurate. Do not paste confidential or client data.');
  try {
    for (;;) {
      const prompt = (await rl.question('You> ')).trim();
      if (prompt === '/exit' || prompt === '/quit') return 0;
      if (!prompt) continue;
      if (prompt.length > 2500) {
        console.log('LIMIT: max 2500 characters per prompt.');
        continue;
      }
      const response = await fetchImpl(LOOPBACK + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selected, prompt, stream: false, think: false,
          options: { num_gpu: 0, num_ctx: 1024, num_predict: 350, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (!response.ok) {
        console.log('LOCAL_MODEL_ERROR: HTTP ' + response.status);
        continue;
      }
      const data = await response.json();
      if (data.model !== selected || data.done !== true || typeof data.response !== 'string') {
        console.log('LOCAL_MODEL_REPLY_INVALID');
        continue;
      }
      console.log('AI> ' + data.response.trim() + '\n');
    }
  } finally {
    rl.close();
  }
}

async function setupLocalModel(settings = {}) {
  const { ids } = await readLocalModels(settings.fetchImpl || globalThis.fetch);
  if (ids.includes('qwen3:4b')) {
    console.log('qwen3:4b already installed locally; no download needed.');
    return 0;
  }
  const exe = findCommand('ollama', settings);
  if (!exe) throw Error('OLLAMA_NOT_INSTALLED');
  console.log('Optional one-time download: qwen3:4b approximately 2.5 GB, requires internet/disk.');
  console.log('Model license, quota and language quality must be reviewed. No paid API or CRM.');
  const rl = readline.createInterface({
    input: settings.input || process.stdin,
    output: settings.output || process.stdout,
  });
  let answer;
  try { answer = (await rl.question('Type INSTALL to start Ollama pull (anything else cancels): ')).trim(); }
  finally { rl.close(); }
  if (answer !== 'INSTALL') {
    console.log('Cancelled. No model downloaded.');
    return 2;
  }
  return runLocalProcess(exe, ['pull', 'qwen3:4b']);
}

async function main(argv = process.argv.slice(2), settings = {}) {
  const action = argv[0] || 'help';
  if (argv.length > 1 || !ACTIONS.includes(action)) {
    printHelp();
    return 2;
  }
  switch (action) {
    case 'help': printHelp(); return 0;
    case 'status': await showStatus(settings); return 0;
    case 'test':
      return runLocalProcess(process.execPath,
        ['--test', 'tests/ai-content-pipeline.test.cjs',
          'tests/ai-local-smoke.test.cjs', 'tests/imperion-ai.test.cjs']);
    case 'preview':
      return runLocalProcess(process.execPath, ['ops/ai-local-smoke.cjs']);
    case 'smoke':
      return runLocalProcess(process.execPath, ['ops/ai-local-smoke.cjs', '--ollama']);
    case 'editor':
      return runLocalProcess(findCommand('code', settings), ['--new-window', ROOT]);
    case 'codex':
      console.log('Starting authorized Codex in READ-ONLY sandbox. Review before any edits.');
      return runLocalProcess(findCommand('codex', settings), ['--cd', ROOT, '--sandbox', 'read-only']);
    case 'agy':
      console.log('Starting Google Antigravity in PLAN+sandbox. Account verification may be required.');
      return runLocalProcess(findCommand('agy', settings), ['--mode', 'plan', '--sandbox']);
    case 'chat':
      return localChat(settings);
    case 'setup-model':
      return setupLocalModel(settings);
  }
  return 2;
}

if (require.main === module) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error('IMPERION_AI_ERROR: ' + (error?.message || 'UNKNOWN').replace(/\s+/g, ' ').slice(0, 220));
    process.exitCode = 1;
  });
}

module.exports = { ROOT, LOOPBACK, ALLOWED_MODELS, ACTIONS, findCommand, selectLocalModel, readLocalModels, showStatus, localChat, setupLocalModel, main };
