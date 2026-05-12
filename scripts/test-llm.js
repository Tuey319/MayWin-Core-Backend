#!/usr/bin/env node
/**
 * Standalone LLM extraction quality test for MayWin chatbot.
 * Tests Gemini models directly — no NestJS server needed.
 *
 * Usage:
 *   node scripts/test-llm.js              # test all models
 *   node scripts/test-llm.js flash        # gemini-2.5-flash only
 *   node scripts/test-llm.js flash-lite   # gemini-2.5-flash-lite only
 *   node scripts/test-llm.js gemma        # gemma-3-27b-it only
 *
 * Setup:
 *   cp scripts/.env.llm-test.example scripts/.env.llm-test
 *   # paste your GEMINI_API_KEY in .env.llm-test
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Load env file ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env.llm-test');
if (!fs.existsSync(envPath)) {
  console.error('\nMissing scripts/.env.llm-test');
  console.error('Run: cp scripts/.env.llm-test.example scripts/.env.llm-test');
  console.error('Then paste your GEMINI_API_KEY inside.\n');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

// Collect all GEMINI_API_KEY, GEMINI_API_KEY2, GEMINI_API_KEY3, ... in order
const API_KEYS = Object.entries(env)
  .filter(([k, v]) => /^GEMINI_API_KEY\d*$/.test(k) && v && !v.includes('paste_your'))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, v]) => v);

if (API_KEYS.length === 0) {
  console.error('\nNo valid GEMINI_API_KEY found in scripts/.env.llm-test\n');
  process.exit(1);
}

// ── Key rotation state ─────────────────────────────────────────────────────
// cooldowns[key] = timestamp (ms) until which the key is in cooldown
const cooldowns = {};
let keyIndex = 0;

// If all keys need to wait longer than this, treat the model as quota-exhausted
// and throw so the outer loop can skip to the next model.
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns the next available API key, waiting if all are in cooldown.
 * Rotates round-robin, skipping cooled-down keys.
 * Throws 'QUOTA_EXHAUSTED' if all keys are cooling for > MAX_WAIT_MS.
 */
async function nextKey() {
  while (true) {
    const key = API_KEYS[keyIndex % API_KEYS.length];
    keyIndex++;
    const coolUntil = cooldowns[key] || 0;
    if (Date.now() >= coolUntil) return key;

    // All keys may be cooling — find soonest available
    const soonest = Math.min(...API_KEYS.map(k => cooldowns[k] || 0));
    const wait = soonest - Date.now();
    if (wait > MAX_WAIT_MS) {
      throw new Error('QUOTA_EXHAUSTED');
    }
    if (wait > 0) {
      process.stdout.write(`  ${c.yellow}[rate limit] all keys cooling, waiting ${Math.ceil(wait / 1000)}s...${c.reset}\r`);
      await new Promise(r => setTimeout(r, wait + 200));
    }
  }
}

/** Parse retryDelay seconds from a 429 error message, defaulting to 65s. */
function parseRetryDelay(err) {
  const match = err?.message?.match(/retryDelay["\s:]+(\d+(?:\.\d+)?)s/);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 + 1000 : 65_000;
}

// ── Models ─────────────────────────────────────────────────────────────────
const ALL_MODELS = {
  'flash':      'gemini-2.5-flash',
  'flash-lite': 'gemini-2.5-flash-lite',
  'gemma':      'gemma-4-26b-a4b-it',
};

const arg = process.argv[2];
const modelsToTest = (arg && ALL_MODELS[arg])
  ? { [arg]: ALL_MODELS[arg] }
  : ALL_MODELS;

// ── Load test cases (merge llm-test-cases.json + test-inputs/*.js, dedupe by id) ──
function loadCases() {
  const seen = new Set();
  const all = [];
  const addCases = (arr) => {
    for (const c of arr) {
      if (!seen.has(c.id)) { seen.add(c.id); all.push(c); }
    }
  };
  // Base JSON file
  const jsonPath = path.join(__dirname, 'llm-test-cases.json');
  if (fs.existsSync(jsonPath)) addCases(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  // test-inputs/*.js — strip "export default varName =" prefix and parse as JSON
  const inputsDir = path.join(__dirname, 'test-inputs');
  if (fs.existsSync(inputsDir)) {
    for (const f of fs.readdirSync(inputsDir).filter(f => f.endsWith('.js'))) {
      const raw = fs.readFileSync(path.join(inputsDir, f), 'utf8');
      // Strip JS line comments, find first '[', parse from there
      const noComments = raw.replace(/\/\/[^\n]*/g, '');
      const start = noComments.indexOf('[');
      const trimmed = start !== -1 ? noComments.slice(start).trim() : '';
      try { addCases(JSON.parse(trimmed)); } catch { console.warn(`  [warn] could not parse ${f}`); }
    }
  }
  return all;
}
const cases = loadCases();

// ── Gemini call (same prompt as webhook.service.ts) ────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function callGemini(apiKey, modelName, text) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const isGemma = modelName.startsWith('gemma');
  const model = genAI.getGenerativeModel({
    model: modelName,
    // Gemma models don't support responseMimeType — use free-text mode
    generationConfig: isGemma ? {} : { responseMimeType: 'application/json' },
  });
  const today = new Date().toISOString();
  const prompt = `Today is ${today}. Extract nurse shift preferences from: "${text}".
Return ONLY a JSON array of objects with no other text: [{"date": "YYYY-MM-DD", "shift": "morning|afternoon|night|leave"}].
If no shift preference is found, return an empty array: []`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const stripped = raw.replace(/```json|```/g, '').trim();
  // Try each '[' position last-to-first — model often echoes example format before the answer
  const positions = [];
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '[') positions.push(i);
  }
  for (let i = positions.length - 1; i >= 0; i--) {
    const sub = stripped.slice(positions[i]);
    const end = sub.lastIndexOf(']');
    if (end === -1) continue;
    try {
      const arr = JSON.parse(sub.slice(0, end + 1));
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  return [];
}

/**
 * Calls Gemini with automatic key rotation on 429.
 * Retries indefinitely — nextKey() handles all waiting.
 * Returns { extracted, keyUsed }.
 */
async function callGeminiWithRotation(modelName, text) {
  let quotaStrikes = 0;
  let serverErrStrikes = 0;
  while (true) {
    const key = await nextKey(); // throws QUOTA_EXHAUSTED if all keys cooling > MAX_WAIT_MS
    try {
      const extracted = await callGemini(key, modelName, text);
      return { extracted, keyUsed: API_KEYS.indexOf(key) + 1 };
    } catch (err) {
      const is429 = err?.status === 429 || String(err?.status) === '429' || err?.message?.includes('429');
      const isQuota = /quota|resource.?exhausted/i.test(err?.message || '');
      const is5xx = err?.message?.includes('500') || err?.message?.includes('503');
      if (is429 || isQuota) {
        quotaStrikes++;
        const delay = parseRetryDelay(err);
        cooldowns[key] = Date.now() + delay;
        if (delay > MAX_WAIT_MS || quotaStrikes >= API_KEYS.length * 2) {
          throw new Error('QUOTA_EXHAUSTED');
        }
        continue;
      }
      if (is5xx && serverErrStrikes < 3) {
        serverErrStrikes++;
        await new Promise(r => setTimeout(r, 5000 * serverErrStrikes)); // 5s, 10s, 15s backoff
        continue;
      }
      throw err; // non-retryable error — propagate
    }
  }
}

// ── Evaluate result against expected ──────────────────────────────────────
function evaluate(extracted, expect) {
  if (expect.empty) {
    return extracted.length === 0 ? 'PASS' : 'FAIL';
  }

  if (!extracted || extracted.length === 0) return 'FAIL';

  const allItemsFound = expect.items.every(exp =>
    extracted.some(e => {
      const shiftOk = e.shift === exp.shift;
      const dateOk = expect.shift_only || !exp.date || e.date === exp.date;
      return shiftOk && dateOk;
    }),
  );

  if (!allItemsFound) return 'FAIL';
  if (expect.count !== undefined && extracted.length !== expect.count) return 'PARTIAL';
  return 'PASS';
}

// ── ANSI colors ───────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
};

function colorResult(r) {
  if (r === 'PASS')    return `${c.green}PASS${c.reset}   `;
  if (r === 'PARTIAL') return `${c.yellow}PARTIAL${c.reset}`;
  return `${c.red}FAIL${c.reset}   `;
}

// ── Results persistence ───────────────────────────────────────────────────
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

function saveResults(runMeta, modelResults) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const modelTag = Object.keys(modelsToTest).join('+');
  const filename = `${ts}_${modelTag}.json`;
  const outPath = path.join(resultsDir, filename);
  fs.writeFileSync(outPath, JSON.stringify({ meta: runMeta, models: modelResults }, null, 2));
  return outPath;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const modelCount = Object.keys(modelsToTest).length;
  const delayMs = Math.max(200, Math.ceil(15_000 / (API_KEYS.length * API_KEYS.length)));
  const runStart = new Date().toISOString();
  console.log(`\n${c.bold}MayWin Chatbot — LLM Extraction Quality Test${c.reset}`);
  console.log(`${c.dim}${cases.length} cases · ${modelCount} model(s) · ${API_KEYS.length} key(s) · ~${delayMs}ms/call${c.reset}\n`);

  const summary = {};
  const modelResults = {};

  for (const [alias, modelName] of Object.entries(modelsToTest)) {
    console.log(`${c.cyan}${c.bold}── ${modelName} ${'─'.repeat(Math.max(0, 50 - modelName.length))}${c.reset}`);

    let pass = 0, partial = 0, fail = 0, skipped = 0;
    const caseResults = [];
    let quotaExhausted = false;

    for (const tc of cases) {
      if (quotaExhausted) {
        caseResults.push({ id: tc.id, input: tc.input, result: 'SKIP', got: null, keyUsed: null, error: 'quota exhausted' });
        skipped++;
        continue;
      }

      process.stdout.write(`  ${tc.id.padEnd(30)} `);
      const caseRecord = { id: tc.id, input: tc.input, result: null, got: null, keyUsed: null, error: null };
      try {
        const { extracted, keyUsed } = await callGeminiWithRotation(modelName, tc.input);
        const result = evaluate(extracted, tc.expect);

        const got = extracted.length
          ? extracted.map(e => `${e.shift}@${e.date ?? '?'}`).join(', ')
          : '(empty)';
        const keyTag = API_KEYS.length > 1 ? ` ${c.dim}[key${keyUsed}]${c.reset}` : '';
        console.log(`${colorResult(result)}${keyTag} ${c.dim}→ ${got}${c.reset}`);

        caseRecord.result = result;
        caseRecord.got = extracted;
        caseRecord.keyUsed = keyUsed;

        if (result === 'PASS')    pass++;
        else if (result === 'PARTIAL') partial++;
        else                      fail++;
      } catch (err) {
        if (err.message === 'QUOTA_EXHAUSTED') {
          console.log(`${c.yellow}SKIP   ${c.reset} ${c.dim}[quota exhausted — skipping remaining cases]${c.reset}`);
          caseRecord.result = 'SKIP';
          caseRecord.error = 'quota exhausted';
          skipped++;
          quotaExhausted = true;
        } else {
          console.log(`${c.red}ERROR  ${c.reset} ${c.dim}${err.message.split('\n')[0]}${c.reset}`);
          caseRecord.result = 'ERROR';
          caseRecord.error = err.message.split('\n')[0];
          fail++;
        }
      }
      caseResults.push(caseRecord);

      await new Promise(r => setTimeout(r, delayMs));
    }

    const total = cases.length;
    const pct = Math.round(pass / total * 100);
    const color = pct >= 80 ? c.green : pct >= 60 ? c.yellow : c.red;
    const skipTag = skipped ? `, ${skipped} skipped` : '';
    console.log(`\n  Result: ${color}${c.bold}${pass}/${total} passed${c.reset} (${partial} partial, ${fail} fail${skipTag}, ${pct}%)\n`);
    summary[alias] = { pass, partial, fail, skipped, total, pct };
    modelResults[alias] = { model: modelName, pass, partial, fail, skipped, total, pct, cases: caseResults };
  }

  // comparison table when testing multiple models
  if (modelCount > 1) {
    console.log(`${c.bold}── Summary ${'─'.repeat(42)}${c.reset}`);
    for (const [alias, s] of Object.entries(summary)) {
      const filled  = Math.round(s.pct / 5);
      const bar     = '█'.repeat(filled) + '░'.repeat(20 - filled);
      const color   = s.pct >= 80 ? c.green : s.pct >= 60 ? c.yellow : c.red;
      const skipSuffix = s.skipped ? `, ${s.skipped} skipped` : '';
      console.log(`  ${alias.padEnd(12)} ${color}${bar}${c.reset} ${s.pct}%  (${s.pass}/${s.total} pass, ${s.partial} partial${skipSuffix})`);
    }
    console.log();
  }

  const outPath = saveResults(
    { runAt: runStart, keys: API_KEYS.length, delayMs, totalCases: cases.length },
    modelResults,
  );
  console.log(`${c.dim}Results saved → ${outPath}${c.reset}\n`);
}

main().catch(err => {
  console.error(`\n${c.red}Fatal:${c.reset}`, err.message);
  process.exit(1);
});
