'use strict';
/**
 * Local-only completion journal for existing public-ai-draft BrowserBridge jobs.
 * Replays an already completed REVIEW DRAFT without new inference after a
 * broker acknowledgement is lost. Missing, partial, colliding or corrupted
 * receipts never authorize model calls; quota remains a separate gate.
 * Not a provider billing cap, not an approval to send, not shared to cloud.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const JOB_RE = /^[A-Za-z0-9._-]{6,120}$/;
const HEX_RE = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 12000;
function sha256(x) { return crypto.createHash('sha256').update(x, 'utf8').digest('hex'); }
function isRecord(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function fingerprint(task) {
  if (!isRecord(task) || !JOB_RE.test(task.job_id || ''))
    throw new Error('JOURNAL_TASK_INVALID');
  return sha256(JSON.stringify([
    task.job_id, task.owner_entity, task.source_url, task.purpose, task.language
  ]));
}
function validateResult(result, task) {
  return isRecord(result) && result.status === 'DRAFT_FOR_OWNER_REVIEW' &&
    result.job_id === task.job_id && result.owner_entity === 'OSVC' &&
    result.source_url === task.source_url && result.source_checked === true &&
    result.owner_approval_required === true &&
    result.provider === 'ollama_local' && result.model === 'imperion-qwen35:4b' &&
    result.execution_mode === 'LOCAL_QWEN_PUBLIC_DRAFT_ONLY' &&
    typeof result.source_sha256 === 'string' && HEX_RE.test(result.source_sha256) &&
    typeof result.draft === 'string' && result.draft.trim().length > 0 &&
    result.draft.length <= 5000 &&
    ['messages_sent', 'posts_published', 'payments_created', 'external_actions']
      .every(field => result[field] === 0);
}
function createResultJournal({ directory } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory))
    throw new Error('JOURNAL_ABSOLUTE_DIRECTORY_REQUIRED');
  const root = path.resolve(directory);
  function target(task) { return path.join(root, sha256(task.job_id) + '.json'); }
  async function checkRoot() {
    let st;
    try { st = await fs.lstat(root); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('JOURNAL_ROOT_UNSAFE');
    return true;
  }
  async function read(task) {
    const fp = fingerprint(task);
    if (!(await checkRoot())) return null;
    const file = target(task);
    let stat;
    try { stat = await fs.lstat(file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 30 || stat.size > MAX_FILE_BYTES)
      throw new Error('JOURNAL_FILE_UNSAFE');
    const raw = await fs.readFile(file, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_FILE_BYTES) throw new Error('JOURNAL_FILE_OVERSIZE');
    let record;
    try { record = JSON.parse(raw); }
    catch { throw new Error('JOURNAL_CORRUPT'); }
    if (!isRecord(record) || record.version !== 1 ||
        typeof record.task_fingerprint !== 'string' ||
        !HEX_RE.test(record.result_sha256 || '') || !isRecord(record.result))
      throw new Error('JOURNAL_FORMAT_INVALID');
    if (record.task_fingerprint !== fp) throw new Error('JOURNAL_JOB_ID_COLLISION');
    if (!validateResult(record.result, task) ||
        sha256(JSON.stringify(record.result)) !== record.result_sha256)
      throw new Error('JOURNAL_RESULT_INTEGRITY_FAILED');
    return record.result;
  }
  async function commit(task, result) {
    const fp = fingerprint(task);
    if (!validateResult(result, task)) throw new Error('JOURNAL_RESULT_NOT_APPROVED');
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    if (!(await checkRoot())) throw new Error('JOURNAL_ROOT_MISSING');
    const file = target(task);
    const record = {
      version: 1, task_fingerprint: fp,
      result_sha256: sha256(JSON.stringify(result)),
      result
    };
    const body = JSON.stringify(record) + '\n';
    if (Buffer.byteLength(body, 'utf8') > MAX_FILE_BYTES) throw new Error('JOURNAL_TOO_LARGE');
    let handle;
    try {
      handle = await fs.open(file, 'wx', 0o600);
      await handle.writeFile(body, 'utf8');
      await handle.sync();
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const prior = await read(task);
      if (!prior || JSON.stringify(prior) !== JSON.stringify(result))
        throw new Error('JOURNAL_EXISTING_RECEIPT_MISMATCH');
    } finally { if (handle) await handle.close(); }
    return result;
  }
  return { read, commit };
}
module.exports = { createResultJournal };
