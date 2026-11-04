#!/usr/bin/env node
/** Packaging integrity checks, not browser rendering or font-layout tests. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const sourceCSS = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const styles = html.match(/<style>([^]*?)<\/style>/)?.[1];
assert.ok(styles, 'Built guide must contain its stylesheet.');
assert.doesNotMatch(html, /__[A-Z][A-Z0-9_]*__/, 'Built guide contains unresolved placeholders.');

const expected = [
  ['fonts/Roboto-Light.ttf', 'font/ttf', 1],
  ['fonts/Roboto-Regular.ttf', 'font/ttf', 1],
  ['fonts/Roboto-Bold.ttf', 'font/ttf', 1],
  ['brand/wave-down.svg', 'image/svg+xml', 1],
  ['brand/wave-down-home.svg', 'image/svg+xml', 1],
  ['logo-white.svg', 'image/svg+xml', 2],
  ['brand/logo-colour.png', 'image/png', 1],
];
if (sourceCSS.includes('__WAVE_UP__')) expected.push(['brand/wave-up.svg', 'image/svg+xml', 1]);
let bytes = 0;
for (const [name, mime, occurrences] of expected) {
  const source = fs.readFileSync(path.join(root, 'assets-source', name));
  const uri = `data:${mime};base64,${source.toString('base64')}`;
  assert.equal(html.split(uri).length - 1, occurrences, `${name}: embedded bytes/count differ from the supplied source.`);
  if (mime === 'font/ttf') {
    assert.equal(source.readUInt32BE(0), 0x00010000, `${name}: expected a TrueType font.`);
    assert.ok(styles.includes(uri), `${name}: font must be part of the embedded stylesheet.`);
  }
  bytes += source.length;
}

const decode = text => text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot);/gi, (_, entity) => {
  if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
  return {amp: '&', lt: '<', gt: '>', quot: '"'}[entity.toLowerCase()];
});
const license = html.match(/<template id="font-license"><pre>([^]*?)<\/pre><\/template>/)?.[1];
assert.ok(license, 'Standalone guide must carry the complete font license.');
assert.equal(decode(license), fs.readFileSync(path.join(root, 'assets-source/fonts/OFL.txt'), 'utf8'),
  'Embedded font license differs from the bundled OFL text.');

// Documentation links are permitted; runtime assets must remain embedded.
assert.doesNotMatch(styles, /@import\b/i, 'Stylesheet imports would break offline use.');
for (const match of styles.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
  assert.ok(match[1].startsWith('data:') || match[1].startsWith('#'), `Non-embedded CSS asset: ${match[1]}`);
}
assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, 'External script files would break the single-file export.');
const markup = html.replace(/<script\b[^>]*>[^]*?<\/script>/g, '').replace(/<style\b[^>]*>[^]*?<\/style>/g, '');
for (const match of markup.matchAll(/\bsrc\s*=\s*["']([^"']*)["']/g)) {
  assert.ok(match[1].startsWith('data:'), `Non-embedded markup asset: ${match[1]}`);
}
assert.doesNotMatch(markup, /<link\b[^>]*\brel=["']stylesheet["']/i, 'Stylesheets must be embedded.');

console.log(`PASS: ${expected.length} brand assets (${bytes} unique source bytes), exact embedded copies, complete font license, and no external runtime style/script/image references.`);
console.log('Packaging integrity only; visual layout and font rendering require browser verification.');
