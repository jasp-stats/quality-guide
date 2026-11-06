#!/usr/bin/env node
/** Verify both deliverables after `python3 build.py`; standard library only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'media.json'), 'utf8'));
const offlineFile = 'JASP-Quality-Guide.html';

function readBuilt(name) {
  const file = path.join(dist, name);
  const html = fs.readFileSync(file, 'utf8');
  const block = html.match(/<script id="guide-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(block, `${name}: built HTML must contain the guide data.`);
  return {html, data: JSON.parse(block[1]), bytes: fs.statSync(file).size};
}

function sourceContent(names) {
  const result = {};
  for (const name of names) {
    const addition = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    for (const id of Object.keys(addition)) assert.ok(!Object.hasOwn(result, id), `${name}: duplicate ${id}.`);
    Object.assign(result, addition);
  }
  return result;
}

const analyses = sourceContent(['qc-content.json', 'method-content.json', 'correlation-content.json',
  'classical-content.json', 'survival-content.json', 'acceptance-content.json']);
const examples = sourceContent(['examples.json', 'correlation-examples.json', 'classical-examples.json',
  'survival-examples.json', 'acceptance-examples.json']);
const online = readBuilt('index.html');
const offline = readBuilt(offlineFile);
assert.deepEqual(online.data.delivery, {mode: 'online', offlineFile}, 'Online delivery contract is incorrect.');
assert.deepEqual(offline.data.delivery, {mode: 'offline'}, 'Offline delivery contract is incorrect.');
assert.ok(online.bytes < 2_000_000, `Initial online HTML must stay below 2 MB; found ${online.bytes} bytes.`);
assert.doesNotMatch(online.html, /data:(?:video\/mp4|application\/octet-stream);base64,[A-Za-z0-9+/]{16}/,
  'Initial online HTML must not embed video or JASP payloads.');

const placeholderBytes = fs.readFileSync(path.join(root, manifest.videoPlaceholder.file));
assert.deepEqual([...placeholderBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
  'Missing-video picture must have a PNG signature.');
for (const [mode, built] of [['online', online], ['offline', offline]]) {
  const {html, data} = built;
  assert.deepEqual(data.analyses, analyses, `${mode}: analysis content differs from source.`);
  assert.deepEqual(data.examples, examples, `${mode}: example content differs from source.`);
  assert.deepEqual(data.media.defaults, manifest.defaults, `${mode}: media defaults are stale.`);
  assert.deepEqual(data.media.analyses, manifest.analyses, `${mode}: analysis overrides are stale.`);
  assert.deepEqual(Object.keys(data.media.assets).sort(), Object.keys(manifest.assets).sort(),
    `${mode}: asset inventory differs from media.json.`);
  const placeholder = data.media.videoPlaceholder;
  assert.ok(placeholder?.src.startsWith('data:image/png;base64,'), `${mode}: placeholder must be an embedded PNG.`);
  assert.deepEqual(Buffer.from(placeholder.src.split(',')[1], 'base64'), placeholderBytes,
    `${mode}: missing-video picture differs from source.`);
  assert.equal(placeholder.alt, manifest.videoPlaceholder.alt, `${mode}: missing accessible placeholder text.`);
  assert.ok(placeholder.alt.trim(), `${mode}: placeholder needs accessible text.`);
  assert.equal(html.indexOf(placeholder.src), html.lastIndexOf(placeholder.src),
    `${mode}: placeholder must be embedded once.`);
}

let bytes = placeholderBytes.length;
const expectedMediaFiles = new Set();
for (const [id, source] of Object.entries(manifest.assets)) {
  assert.ok(['video', 'jasp'].includes(source.kind), `${id}: unknown asset kind.`);
  const original = fs.readFileSync(path.join(root, source.file));
  assert.ok(original.length > 0, `${id}: empty media file.`);
  const extension = source.kind === 'video' ? '.mp4' : '.jasp';
  const hash = createHash('sha256').update(original).digest('hex');
  const filename = hash + extension;
  const relativeUrl = 'media/' + filename;
  expectedMediaFiles.add(filename);
  const publishedFile = path.join(dist, 'media', filename);
  assert.ok(fs.lstatSync(publishedFile).isFile(), `${id}: published media must be a regular file.`);
  assert.deepEqual(fs.readFileSync(publishedFile), original, `${id}: online bytes differ from source.`);
  const mime = source.kind === 'video' ? 'video/mp4' : 'application/octet-stream';
  const prefix = `data:${mime};base64,`;
  const embedded = offline.data.media.assets[id];
  assert.ok(embedded.src.startsWith(prefix), `${id}: incorrect offline media type.`);
  assert.deepEqual(Buffer.from(embedded.src.slice(prefix.length), 'base64'), original,
    `${id}: offline bytes differ from source.`);
  assert.equal(offline.html.indexOf(embedded.src), offline.html.lastIndexOf(embedded.src),
    `${id}: binary must be embedded once, not repeated per guide.`);
  const metadata = {title: source.title, note: source.note};
  if (source.kind === 'jasp') {
    metadata.filename = source.filename;
    assert.equal(original.subarray(0, 2).toString(), 'PK', `${id}: expected a JASP ZIP archive.`);
  } else {
    assert.equal(original.subarray(4, 8).toString(), 'ftyp', `${id}: expected an MP4 file-type box.`);
  }
  assert.deepEqual(online.data.media.assets[id], {...metadata, src: relativeUrl},
    `${id}: incorrect online URL, metadata, or download filename.`);
  assert.deepEqual(embedded, {...metadata, src: embedded.src}, `${id}: incorrect offline metadata or download filename.`);
  bytes += original.length;
}
const generatedMediaFiles = fs.readdirSync(path.join(dist, 'media'))
  .filter(name => /^[0-9a-f]{64}\.(mp4|jasp)$/.test(name));
assert.deepEqual(generatedMediaFiles.sort(), [...expectedMediaFiles].sort(), 'Stale generated media files remain.');

let missingVideos = 0, missingJaspFiles = 0;
const selectedAssetIds = new Set();
for (const analysisId of Object.keys(analyses)) {
  const selections = {...manifest.defaults, ...manifest.analyses[analysisId]};
  for (const kind of ['video', 'jasp']) {
    const selected = selections[kind];
    if (selected === null) {
      if (kind === 'video') missingVideos++; else missingJaspFiles++;
      continue;
    }
    assert.equal(typeof selected, 'string', `${analysisId}: resource must be a known ID or explicit null.`);
    assert.ok(manifest.assets[selected], `${analysisId}: unknown ${kind} resource.`);
    assert.equal(manifest.assets[selected].kind, kind, `${analysisId}: wrong resource kind for ${kind}.`);
    selectedAssetIds.add(selected);
  }
}
for (const analysisId of Object.keys(manifest.analyses)) {
  assert.ok(analyses[analysisId], `Unknown analysis media override: ${analysisId}.`);
}
assert.deepEqual([...selectedAssetIds].sort(), Object.keys(manifest.assets).sort(),
  'Every media asset must be reachable from an analysis. Connect unused assets or remove them from media.json.');

console.log(`PASS: online ${online.bytes} bytes / standalone ${offline.bytes} bytes; ` +
  `${Object.keys(analyses).length} guides and ${Object.keys(examples).length} datasets match source in both modes.`);
console.log(`PASS: ${Object.keys(manifest.assets).length} media assets and one placeholder / ${bytes} bytes ` +
  `match source in both modes; ${missingVideos} missing videos / ${missingJaspFiles} missing JASP files.`);
console.log('Media bytes and delivery contracts checked; browser playback and download interactions require browser verification.');
