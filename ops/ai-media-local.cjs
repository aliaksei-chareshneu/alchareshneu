'use strict';
/**
 * Optional PhotoCraft local media stage for an EXISTING approved SocialPublishing job.
 * No network, CMS/CRM access, email, publishing, paid providers or additional queue.
 * PhotoCraft is experimental: real output ALWAYS requires human visual review.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertJob, fingerprint } = require('./ai-content-pipeline.cjs');

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;

function existsNoFollow(file) {
  try { fs.lstatSync(file); return true; }
  catch (err) { if (err.code === 'ENOENT') return false; throw err; }
}

function stagedPath(root, target, requireExisting = true) {
  if (!path.isAbsolute(root) || !path.isAbsolute(target)) throw Error('ABSOLUTE_STAGING_PATHS_REQUIRED');
  const base = fs.realpathSync(root);
  if (!fs.statSync(base).isDirectory()) throw Error('STAGING_ROOT_INVALID');
  const resolved = requireExisting
    ? fs.realpathSync(target)
    : path.join(fs.realpathSync(path.dirname(target)), path.basename(target));
  const relative = path.relative(base, resolved);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw Error('OUTSIDE_STAGING_ROOT');
  }
  return resolved;
}

function inspectPng(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size < 33 || stat.size > MAX_OUTPUT_BYTES) throw Error('PHOTOCRAFT_OUTPUT_SIZE_INVALID');
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw Error('PHOTOCRAFT_OUTPUT_NOT_PNG');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192) throw Error('PHOTOCRAFT_IMAGE_DIMENSIONS_INVALID');
  return { width, height, bytes: stat.size, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

function runMedia(job, options) {
  assertJob(job);
  if (job.image_rights_approved !== true) throw Error('IMAGE_RIGHTS_REVIEW_REQUIRED');
  if (!options || !options.root || !options.input || !options.output) throw Error('MEDIA_PATHS_REQUIRED');
  const input = stagedPath(options.root, options.input);
  const output = stagedPath(options.root, options.output, false);
  if (!fs.statSync(input).isFile()) throw Error('MEDIA_INPUT_NOT_FILE');
  if (!/\.(png|jpe?g|psd)$/i.test(input)) throw Error('MEDIA_INPUT_TYPE_NOT_ALLOWED');
  if (!/\.png$/i.test(output)) throw Error('MEDIA_OUTPUT_MUST_BE_PNG');
  const inputSize = fs.statSync(input).size;
  if (inputSize < 1 || inputSize > MAX_INPUT_BYTES) throw Error('MEDIA_INPUT_SIZE_INVALID');
  if (existsNoFollow(output)) throw Error('OUTPUT_EXISTS_NO_OVERWRITE');

  const result = {
    existing_job_id: job.job_id, source_fingerprint: fingerprint(job),
    state: 'PREVIEW', published: false, post_url: null,
    business_outcome: 'UNVERIFIED', image: { format: 'png', state: 'PREVIEW' },
  };
  if (options.run !== true) return result;
  if (!options.cli || !path.isAbsolute(options.cli)) throw Error('PHOTOCRAFT_CLI_ABSOLUTE_PATH_REQUIRED');
  const cli = fs.realpathSync(options.cli);
  if (!fs.statSync(cli).isFile()) throw Error('PHOTOCRAFT_CLI_INVALID');

  const temp = path.join(path.dirname(output), '.' + path.basename(output) + '.pc-stage-' + crypto.randomUUID() + '.png');
  // Do not forward cloud/model credentials to an experimental executable.
  const env = {};
  for (const key of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  try {
    const outcome = spawnSync(cli, ['convert', input, temp], {
      shell: false, timeout: 30000, maxBuffer: 65536, windowsHide: true, env,
    });
    if (outcome.error || outcome.status !== 0 || outcome.signal) throw Error('PHOTOCRAFT_EXECUTION_FAILED');
    const verified = inspectPng(temp);
    // Exclusive create: never clobber an existing client/media file.
    fs.copyFileSync(temp, output, fs.constants.COPYFILE_EXCL);
    return {
      ...result, state: 'MEDIA_QA_REQUIRED',
      image: { state: 'LOCAL_UNREVIEWED', format: 'png', filename: path.basename(output), ...verified },
    };
  } finally {
    if (existsNoFollow(temp)) fs.unlinkSync(temp);
  }
}

function requiredFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) {
    throw Error('REQUIRED_FLAG_' + flag.slice(2).toUpperCase().replace(/-/g, '_'));
  }
  return args[index + 1];
}

function main(args) {
  const root = requiredFlag(args, '--root');
  const jobFile = stagedPath(root, requiredFlag(args, '--job'));
  if (!/\.json$/i.test(jobFile)) throw Error('JOB_JSON_REQUIRED');
  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  const result = runMedia(job, {
    root, input: requiredFlag(args, '--input'), output: requiredFlag(args, '--output'),
    cli: args.includes('--run') ? requiredFlag(args, '--cli') : undefined,
    run: args.includes('--run'),
  });
  process.stdout.write(JSON.stringify(result) + '\n');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (err) {
    console.error(/^[A-Z0-9_]+$/.test(err.message) ? err.message : 'MEDIA_STAGE_FAILED');
    process.exitCode = 1;
  }
}
module.exports = { stagedPath, inspectPng, runMedia, main };
