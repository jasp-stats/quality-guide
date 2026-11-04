#!/usr/bin/env node
/** Verify the deliverable after `python3 build.py`; standard library only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'media.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const dataBlock = html.match(/<script id="guide-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(dataBlock, 'Built HTML must contain the guide data.');
const data = JSON.parse(dataBlock[1]);
assert.ok(data.media, 'Rebuild the guide to embed the media manifest.');
assert.deepEqual(data.media.defaults, manifest.defaults, 'Built media defaults are stale.');
assert.deepEqual(data.media.analyses, manifest.analyses, 'Built analysis overrides are stale.');
assert.deepEqual(Object.keys(data.media.assets).sort(), Object.keys(manifest.assets).sort(),
  'Built asset inventory differs from media.json.');

const placeholder = data.media.videoPlaceholder;
assert.ok(placeholder?.src.startsWith('data:image/png;base64,'), 'Missing-video placeholder must be an embedded PNG.');
const placeholderBytes = Buffer.from(placeholder.src.split(',')[1], 'base64');
assert.deepEqual(placeholderBytes, fs.readFileSync(path.join(root, manifest.videoPlaceholder.file)),
  'Missing-video picture must exactly match its source file.');
assert.deepEqual([...placeholderBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
  'Missing-video picture must have a PNG signature.');
assert.equal(placeholder.alt, manifest.videoPlaceholder.alt, 'Missing-video picture must retain its accessible text.');
assert.ok(placeholder.alt.trim(), 'Missing-video picture needs accessible text.');
assert.equal(html.split(placeholder.src).length - 1, 1, 'Missing-video picture must be embedded once.');

let bytes = placeholderBytes.length;
let missingVideos = 0, missingJaspFiles = 0;
for (const [id, source] of Object.entries(manifest.assets)) {
  const embedded = data.media.assets[id];
  const mime = source.kind === 'video' ? 'video/mp4' : 'application/octet-stream';
  const prefix = `data:${mime};base64,`;
  assert.ok(embedded.src.startsWith(prefix), `${id}: incorrect embedded media type.`);
  const original = fs.readFileSync(path.join(root, source.file));
  const decoded = Buffer.from(embedded.src.slice(prefix.length), 'base64');
  assert.deepEqual(decoded, original, `${id}: downloaded/played bytes would differ from the source file.`);
  assert.ok(decoded.length > 0, `${id}: empty media file.`);
  assert.equal(html.split(embedded.src).length - 1, 1, `${id}: binary must be embedded once, not repeated per guide.`);
  assert.equal(embedded.title, source.title, `${id}: stale title.`);
  assert.equal(embedded.note, source.note, `${id}: stale placeholder explanation.`);
  if (source.kind === 'jasp') {
    assert.equal(embedded.filename, source.filename, `${id}: incorrect download filename.`);
    assert.equal(decoded.subarray(0, 2).toString(), 'PK', `${id}: expected a JASP ZIP archive.`);
  } else {
    assert.equal(decoded.subarray(4, 8).toString(), 'ftyp', `${id}: expected an MP4 file-type box.`);
  }
  bytes += decoded.length;
}

for (const analysisId of Object.keys(data.analyses)) {
  const selections = {...data.media.defaults, ...data.media.analyses[analysisId]};
  for (const kind of ['video', 'jasp']) {
    const selected = selections[kind];
    if (selected === null) {
      if (kind === 'video') missingVideos++; else missingJaspFiles++;
      continue;
    }
    assert.equal(typeof selected, 'string', `${analysisId}: resource must be a known ID or explicit null.`);
    assert.ok(data.media.assets[selected], `${analysisId}: unknown ${kind} resource.`);
    assert.equal(manifest.assets[selected].kind, kind, `${analysisId}: wrong resource kind for ${kind}.`);
  }
}
for (const analysisId of Object.keys(data.media.analyses)) {
  assert.ok(data.analyses[analysisId], `Unknown analysis media override: ${analysisId}.`);
}

console.log(`PASS: ${Object.keys(data.analyses).length} guides resolve available or coming-soon resources; ` +
  `${missingVideos} missing videos / ${missingJaspFiles} missing JASP files; ` +
  `${Object.keys(manifest.assets).length} media assets and one placeholder / ${bytes} bytes match their source files exactly.`);
console.log('Media bytes and manifest checked; browser playback and download interactions require browser verification.');
