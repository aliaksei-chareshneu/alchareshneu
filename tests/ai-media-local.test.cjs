'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runMedia, stagedPath, inspectPng } = require('../ops/ai-media-local.cjs');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5v0AAAAASUVORK5CYII=',
  'base64'
);
const approved = {
  job_id: 'PUB-SYNTHETIC-001', owner_entity: 'OSVC', rights_status: 'owned',
  data_classification: 'PUBLIC_APPROVED', public_source_approved: true,
  external_ai_approved: false, image_rights_approved: true, source_lang: 'en',
  existing_status: 'DRAFT',
  source_text: 'Synthetic demo 31.10.2026 18:00 350 CZK https://example.com/only-test',
};

function stage(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imperion-media-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'owned.png');
  const output = path.join(root, 'draft.png');
  fs.writeFileSync(input, PNG_1X1);
  return { root, input, output };
}

function mockCli(t, root, behavior = 'ok') {
  const cli = path.join(root, 'mock-photocraft.cjs');
  const script = '#!/usr/bin/env node\n' +
    'const fs = require("node:fs");\n' +
    'if (process.argv[2] !== "convert" || process.argv.length !== 5) process.exit(9);\n' +
    (behavior === 'fail' ? 'process.exit(2);\n'
      : behavior === 'bad' ? 'fs.writeFileSync(process.argv[4],"not-an-image");\n'
      : 'fs.writeFileSync(process.argv[4],Buffer.from(' + JSON.stringify(PNG_1X1.toString('base64')) + ',"base64"));\n');
  fs.writeFileSync(cli, script, { mode: 0o755 });
  fs.chmodSync(cli, 0o755);
  return cli;
}

test('preview is offline, does not require PhotoCraft installed and never writes output', t => {
  const p = stage(t);
  const result = runMedia(approved, { ...p, run: false });
  assert.equal(result.state, 'PREVIEW');
  assert.equal(result.existing_job_id, approved.job_id);
  assert.equal(result.published, false);
  assert.equal(fs.existsSync(p.output), false);
});

test('public approval and image rights are mandatory before tool execution', t => {
  const p = stage(t);
  assert.throws(() => runMedia({ ...approved, image_rights_approved: false }, { ...p, run: false }), /IMAGE_RIGHTS_REVIEW_REQUIRED/);
  assert.throws(() => runMedia({ ...approved, data_classification: 'CRM_PRIVATE' }, { ...p, run: false }), /PRIVATE_OR_UNAPPROVED_SOURCE/);
  assert.throws(() => runMedia({ ...approved, existing_status: 'PUBLISHED_VERIFIED' }, { ...p, run: false }), /ALREADY_PUBLISHED/);
});

test('paths must be absolute, inside staging root, with no traversal or symlink escape', t => {
  const p = stage(t);
  assert.throws(() => runMedia(approved, { ...p, input: '/etc/hosts' }), /OUTSIDE_STAGING_ROOT/);
  assert.throws(() => runMedia(approved, { ...p, output: path.join(os.tmpdir(), 'media-leak.png') }), /OUTSIDE_STAGING_ROOT/);
  assert.throws(() => stagedPath(p.root, 'relative.png', false), /ABSOLUTE_STAGING_PATHS_REQUIRED/);
  const link = path.join(p.root, 'linked.png');
  try {
    fs.symlinkSync('/etc/hosts', link);
    assert.throws(() => runMedia(approved, { ...p, input: link }), /OUTSIDE_STAGING_ROOT/);
  } catch (err) { if (err.code !== 'EPERM') throw err; }
});

test('output file must not be overwritten', t => {
  const p = stage(t);
  fs.writeFileSync(p.output, 'existing image');
  assert.throws(() => runMedia(approved, { ...p, run: false }), /OUTPUT_EXISTS_NO_OVERWRITE/);
  assert.equal(fs.readFileSync(p.output, 'utf8'), 'existing image');
});

test('mocked CLI convert produces locally verified image, still never publishes', t => {
  const p = stage(t);
  const cli = mockCli(t, p.root);
  const result = runMedia(approved, { ...p, cli, run: true });
  assert.equal(result.state, 'MEDIA_QA_REQUIRED');
  assert.equal(result.published, false);
  assert.equal(result.post_url, null);
  assert.equal(result.image.filename, 'draft.png');
  assert.equal(result.image.width, 1);
  assert.equal(result.image.height, 1);
  assert.equal(result.image.sha256, inspectPng(p.output).sha256);
  assert.throws(() => runMedia(approved, { ...p, cli, run: true }), /OUTPUT_EXISTS_NO_OVERWRITE/);
});

test('failed tool execution cannot create an accepted media file', t => {
  const p = stage(t);
  const cli = mockCli(t, p.root, 'fail');
  assert.throws(() => runMedia(approved, { ...p, cli, run: true }), /PHOTOCRAFT_EXECUTION_FAILED/);
  assert.equal(fs.existsSync(p.output), false);
  assert.equal(fs.readdirSync(p.root).filter(x => x.includes('.pc-stage-')).length, 0);
});

test('non-PNG output is blocked and temporary output is removed', t => {
  const p = stage(t);
  const cli = mockCli(t, p.root, 'bad');
  assert.throws(() => runMedia(approved, { ...p, cli, run: true }), /PHOTOCRAFT_OUTPUT_SIZE_INVALID|PHOTOCRAFT_OUTPUT_NOT_PNG/);
  assert.equal(fs.existsSync(p.output), false);
  assert.equal(fs.readdirSync(p.root).filter(x => x.includes('.pc-stage-')).length, 0);
});

test('non-absolute CLI rejected and no output generated', t => {
  const p = stage(t);
  assert.throws(() => runMedia(approved, { ...p, cli: 'photocraft-cli', run: true }), /PHOTOCRAFT_CLI_ABSOLUTE_PATH_REQUIRED/);
  assert.equal(fs.existsSync(p.output), false);
});
