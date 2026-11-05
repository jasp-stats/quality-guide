#!/usr/bin/env node
/**
 * Source-render integration checks for the built offline guide.
 * Run after `python3 build.py`. Uses Node's standard library only.
 *
 * This deliberately small element model captures generated markup, attributes,
 * and delegated events. It is NOT a browser: no layout, CSS, video decoding,
 * keyboard accessibility, real downloads, or desktop JASP execution is tested.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(directory, 'dist/index.html'), 'utf8');
const decode = text => text.replace(/&(amp|lt|gt|quot|#39);/g,
  (_, name) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"})[name]);
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tagName = tag;
    this.attrs = attrs;
    this.parent = parent;
    this.children = [];
    if (tag === 'video') {
      this.markupSrc = attrs.src;
      if (this.runtime?.videoMode !== 'absent') Object.defineProperty(this, 'srcObject', {
        get: () => this.mediaSourceObject ?? null,
        set: value => {
          this.recordMedia('srcObject', value);
          if (value !== null && this.runtime.videoMode === 'throws') throw new TypeError('Blob srcObject is unsupported.');
          this.mediaSourceObject = value;
        },
      });
    }
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.classList = {
      toggle: (name, enabled) => {
        const classes = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
        if (enabled) classes.add(name); else classes.delete(name);
        this.attrs.class = [...classes].join(' ');
      },
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false),
    };
  }
  get id() { return this.attrs.id; }
  get src() { return this.attrs.src; }
  set src(value) { this.recordMedia('src', value); this.attrs.src = value; }
  get hidden() { return Object.hasOwn(this.attrs, 'hidden'); }
  set hidden(value) { if (value) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  get open() { return Object.hasOwn(this.attrs, 'open'); }
  set open(value) { if (value) this.attrs.open = ''; else delete this.attrs.open; }
  get tabIndex() { return Number(this.attrs.tabindex ?? -1); }
  set tabIndex(value) { this.attrs.tabindex = String(value); }
  get value() { return this.attrs.value || ''; }
  set value(value) { this.attrs.value = value; }
  get innerHTML() { return this.markup || ''; }
  set innerHTML(value) { this.markup = value; this.children = parse(value, this); }
  get textContent() { return this.children.map(child => typeof child === 'string' ? decode(child) : child.textContent).join(''); }
  set textContent(value) { this.children = [String(value)]; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { if (name === 'src') this.recordMedia('removeSrc'); delete this.attrs[name]; }
  get runtime() {
    let root = this;
    while (root.parent) root = root.parent;
    return root.runtimeState;
  }
  recordMedia(type, value) {
    if (this.tagName !== 'video') return;
    const runtime = this.runtime;
    runtime.mediaEvents.push({element: this, type, value,
      mounted: runtime.document.getElementById('analysis-video') === this});
  }
  pause() { this.recordMedia('pause'); }
  load() { this.recordMedia('load'); }
  focus(options) {
    this.focused = true;
    const runtime = this.runtime;
    if (runtime) {
      runtime.focusEvents.push({element: this, options});
      runtime.document.activeElement = this;
    }
  }
  getBoundingClientRect() {
    const {geometry, window} = this.runtime;
    const top = geometry.titleY - window.scrollY;
    return {top, bottom: top + geometry.titleHeight, height: geometry.titleHeight};
  }
  closest(selector) {
    for (let node = this; node; node = node.parent) if (matches(node, selector)) return node;
    return null;
  }
}

function parse(markup, parent) {
  const holder = {children: [], parent};
  const stack = [holder];
  const token = /<!--[^]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g;
  for (const match of markup.matchAll(token)) {
    const text = match[0], current = stack.at(-1);
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      const tag = text.match(/^<\/([^\s>]+)/)[1].toLowerCase();
      const index = stack.findLastIndex(node => node.tagName === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    if (!text.startsWith('<')) { current.children.push(text); continue; }
    const [, tag, rawAttrs] = text.match(/^<([^\s/>]+)([^]*)>$/);
    const attrs = {};
    for (const attr of rawAttrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[attr[1]] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    const node = new Element(tag.toLowerCase(), attrs, current === holder ? parent : current);
    current.children.push(node);
    if (!voidTags.has(node.tagName) && !text.endsWith('/>')) stack.push(node);
  }
  return holder.children;
}
function descendants(node) {
  return node.children.filter(child => child instanceof Element)
    .flatMap(child => [child, ...descendants(child)]);
}
function matches(node, selector) {
  if (selector.startsWith('.')) return (node.attrs.class || '').split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attr) return Object.hasOwn(node.attrs, attr[1]) && (attr[2] === undefined || node.attrs[attr[1]] === attr[2]);
  return node.tagName === selector;
}

const dataText = html.match(/<script id="guide-data" type="application\/json">([^]*?)<\/script>/)?.[1];
assert.ok(dataText, 'Built HTML is missing its embedded guide data.');
// Synthetic bytes exercise Blob transfer and fallback, not video decoding.
const videoFixture = {src: 'data:video/mp4;base64,' + Buffer.from([0, 255, 128, 10, 13, 42]).toString('base64'),
  title: 'Test video walkthrough', note: 'Test video availability.'};
const jaspFixture = {src: 'data:application/octet-stream;base64,UEs=', filename: 'Specific-example.jasp',
  title: 'Specific example', note: 'Specific example note.'};
function boot(initialHash = '#/', initialScrollY = 0, videoMode = 'throws', mediaOverride = null) {
  const bootData = JSON.parse(dataText);
  if (mediaOverride) bootData.media = mediaOverride;
  const documentRoot = new Element('document');
  documentRoot.innerHTML = html.replace(/<script\b[^>]*>[^]*?<\/script>/g, '').replace(/<style\b[^>]*>[^]*?<\/style>/g, '');
  const queryAll = selector => descendants(documentRoot).filter(node => selector.split(',').some(part => {
    const pieces = part.trim().split(/\s+/);
    if (!matches(node, pieces.at(-1))) return false;
    return pieces.length === 1 || Boolean(node.parent?.closest(pieces[0]));
  }));
  const documentEvents = {}, windowEvents = {}, focusEvents = [], scrollEvents = [], mediaEvents = [];
  // Explicitly synthetic geometry: these tests verify scroll/focus decisions,
  // not the pixel position or size of content in a real browser.
  const geometry = {titleY: 220, titleHeight: 70};
  const document = {
    title: '', activeElement: null,
    getElementById: id => id === 'guide-data' ? {textContent: JSON.stringify(bootData)} : queryAll('#' + id)[0] || null,
    querySelectorAll: queryAll,
    querySelector: selector => queryAll(selector)[0] || null,
    addEventListener: (name, callback) => { documentEvents[name] = callback; },
  };
  const location = {hash: initialHash};
  const window = {
    scrollY: initialScrollY, innerHeight: 800,
    scrollTo(options) { scrollEvents.push(options); this.scrollY = options.top; },
    addEventListener: (name, callback) => { windowEvents[name] = callback; },
  };
  const runtime = {documentRoot, document, window, location, queryAll,
    documentEvents, windowEvents, focusEvents, scrollEvents, geometry, mediaEvents, videoMode};
  documentRoot.runtimeState = runtime;
  const sandbox = vm.createContext({document, window, location, navigator: {}, Blob, atob,
    setTimeout: () => 0, clearTimeout() {}});
  for (const script of html.matchAll(/<script([^>]*)>([^]*?)<\/script>/g)) {
    if (!script[1].includes('type="application/json"')) new vm.Script(script[2], {filename: 'built-guide.js'}).runInContext(sandbox, {timeout: 5000});
  }
  return {...runtime, sandbox};
}
const runtime = boot();
const {documentRoot, document, window, location, queryAll, documentEvents,
  windowEvents, focusEvents, scrollEvents, geometry, sandbox} = runtime;
assert.equal(scrollEvents.length, 0, 'Initial home rendering must not force a scroll reset.');
assert.equal(focusEvents.length, 0, 'Initial home rendering must not steal focus.');
vm.runInContext('globalThis.interfaceTest = {analyses: ANALYSES, scenarios: SCENARIOS, goals: GOALS, questions: NODES, guards: GUARDS, references: REFERENCES, samples: SAMPLES, media: DATA.media, planText, analysisMedia, walk};', sandbox);
const api = sandbox.interfaceTest;
const app = document.getElementById('app');
const count = selector => queryAll(selector).length;
const action = (name, value) => queryAll('[data-action]').find(node => node.dataset.action === name && (value === undefined || node.dataset.value === value));
function go(hash) { location.hash = hash; windowEvents.hashchange(); uniqueIds(hash); }
async function click(node) {
  assert.ok(node, 'Expected a rendered action element.');
  const previous = location.hash;
  await documentEvents.click({target: node, preventDefault() {}});
  if (previous !== location.hash) windowEvents.hashchange();
}
function exposed(node) {
  for (let current = node; current; current = current.parent) {
    if (current.hidden || current.tagName === 'details' && !current.open) return false;
  }
  return true;
}
function uniqueIds(context) {
  const ids = queryAll('[id]').map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, `${context}: duplicate generated element IDs.`);
  const headings = queryAll('h1');
  assert.equal(headings.length, 1, `${context}: every route needs exactly one main heading.`);
  assert.equal(headings[0].id, 'page-title', `${context}: main heading must retain its navigation focus target.`);
}
const normalized = value => String(value).replace(/\s+/g, ' ').trim();
function includesText(node, value, context) {
  assert.ok(node && normalized(node.textContent).includes(normalized(value)),
    `${context}: missing retained content: ${String(value).slice(0, 110)}`);
}
function sourcePresent(source, context) {
  const links = queryAll('[href]').filter(node => node.attrs.href === source.url);
  assert.ok(links.some(link => normalized(link.textContent).includes(normalized(source.title))),
    `${context}: missing retained source link: ${source.title}`);
}
function checkAnalysisPage(analysisId, scenario = null) {
  const analysis = api.analyses[analysisId];
  uniqueIds(analysisId);
  assert.equal(document.getElementById('page-title').textContent, analysis.title);
  // These assertions preserve the guide's substance, without fixing its layout
  // or the order of sections. Closed tabs/details still count as available text.
  for (const text of [analysis.summary, analysis.why, ...analysis.path,
    ...analysis.setup.flatMap(step => [step.title, step.text]),
    ...analysis.checks, ...analysis.report,
    ...analysis.columns.flatMap(column => [column.name, column.type, column.description]),
    ...analysis.example.instructions,
    scenario ? scenario.title : analysis.example.title,
    scenario ? scenario.description : analysis.example.story]) {
    includesText(app, text, analysisId);
  }
  if (scenario) includesText(app, scenario.lesson, analysisId + ': worked-example lesson');
  for (const source of analysis.sources) sourcePresent(source, analysisId);
  for (const related of analysis.related || []) {
    includesText(action('analysis', related.id), related.label, analysisId + ': related analysis');
  }
  for (const name of ['plan', 'print', 'copy-plan']) {
    assert.ok(action(name), `${analysisId}: missing ${name} action.`);
  }
  const sampleId = scenario ? scenario.sample : analysis.example.sample;
  if (sampleId) {
    for (const name of ['csv', 'copy-csv']) {
      assert.ok(action(name, sampleId), `${analysisId}: missing ${name} action for its example dataset.`);
    }
    for (const note of api.samples[sampleId].notes) includesText(app, note, analysisId + ': dataset note');
  }
  const selected = api.analysisMedia(analysis);
  const videos = queryAll('video');
  const placeholders = queryAll('.video-placeholder');
  let visual;
  if (selected.video) {
    assert.equal(videos.length, 1, `${analysisId}: an available video needs one player.`);
    assert.equal(placeholders.length, 0, `${analysisId}: an available video must replace the placeholder.`);
    visual = videos[0];
    assert.ok(Object.hasOwn(visual.attrs, 'controls'), `${analysisId}: video needs controls.`);
    assert.ok(!Object.hasOwn(visual.attrs, 'autoplay'), `${analysisId}: video must not autoplay.`);
    assert.equal(visual.markupSrc, undefined, `${analysisId}: video markup must wait for source attachment.`);
    assert.equal(visual.src, selected.video.src, `${analysisId}: wrong video source.`);
  } else {
    assert.equal(videos.length, 0, `${analysisId}: a missing video must not create an empty player.`);
    assert.equal(placeholders.length, 1, `${analysisId}: a missing video needs one coming-soon picture.`);
    visual = placeholders[0];
    assert.equal(visual.tagName, 'img', `${analysisId}: placeholder must be an image.`);
    assert.equal(visual.src, api.media.videoPlaceholder.src, `${analysisId}: wrong placeholder picture.`);
    assert.equal(visual.attrs.alt, api.media.videoPlaceholder.alt, `${analysisId}: missing accessible placeholder wording.`);
    assert.equal(visual.closest('button'), null, `${analysisId}: missing video must not suggest playback.`);
    assert.equal(visual.closest('a'), null, `${analysisId}: missing video must not link to an unavailable file.`);
  }
  const pageElements = descendants(app);
  assert.ok(pageElements.indexOf(visual) < pageElements.indexOf(queryAll('.result-body')[0]),
    `${analysisId}: the video area must remain before the detailed guidance tabs.`);
  const videoNote = document.getElementById('video-note');
  assert.ok(videoNote && exposed(videoNote), `${analysisId}: video availability note must be exposed.`);
  if (selected.video) assert.equal(videoNote.textContent, selected.video.note);
  else assert.match(videoNote.textContent, /coming soon/i);

  assert.equal(document.getElementById('download-title').textContent, 'Annotated JASP file',
    `${analysisId}: download area must identify the annotated JASP file.`);
  const downloads = queryAll('[download]');
  let downloadControl;
  if (selected.jasp) {
    assert.equal(downloads.length, 1, `${analysisId}: an available JASP file needs one download.`);
    assert.equal(action('jasp-unavailable'), undefined, `${analysisId}: an available JASP file must replace the unavailable action.`);
    downloadControl = downloads[0];
    assert.equal(downloadControl.attrs.href, selected.jasp.src, `${analysisId}: wrong JASP download bytes.`);
    assert.equal(downloadControl.attrs.download, selected.jasp.filename, `${analysisId}: wrong download filename.`);
  } else {
    assert.equal(downloads.length, 0, `${analysisId}: a missing JASP file must not create an empty download.`);
    downloadControl = action('jasp-unavailable', analysisId);
    assert.ok(downloadControl, `${analysisId}: a missing JASP file needs a notification action.`);
    assert.equal(downloadControl.tagName, 'button', `${analysisId}: notification action must be a button.`);
    assert.ok(!Object.hasOwn(downloadControl.attrs, 'disabled'), `${analysisId}: notification action must remain operable.`);
    assert.ok(!Object.hasOwn(downloadControl.attrs, 'href'), `${analysisId}: unavailable action must not navigate.`);
  }
  includesText(downloadControl, 'Download annotated JASP file', analysisId + ': download label');
  for (const [control, note] of [[visual, selected.video?.note], [downloadControl, selected.jasp?.note]]) {
    const description = document.getElementById(control.attrs['aria-describedby']);
    assert.ok(description && exposed(description), `${analysisId}: media note must be exposed and associated with its control.`);
    if (note) assert.equal(description.textContent, note, `${analysisId}: available media note changed.`);
    else assert.match(description.textContent, /coming soon/i, `${analysisId}: missing media needs an availability explanation.`);
  }
  const tabs = queryAll('[role="tab"]');
  assert.deepEqual(tabs.map(tab => tab.dataset.value), ['setup', 'example', 'checks'], `${analysisId}: guidance tabs changed.`);
  for (const tab of tabs) {
    const panel = document.getElementById(tab.attrs['aria-controls']);
    assert.ok(panel && panel.attrs.role === 'tabpanel' && panel.attrs['aria-labelledby'] === tab.id,
      `${analysisId}: tab and panel references do not match.`);
    assert.equal(tab.attrs['aria-selected'], String(tab.dataset.value === 'setup'));
    assert.equal(panel.hidden, tab.dataset.value !== 'setup');
  }
  if (analysis.availability?.status === 'beta') {
    const availability = queryAll('.availability-conditional')[0];
    assert.ok(availability?.open && exposed(availability), `${analysisId}: beta requirements must be open on arrival.`);
  }
  if (sampleId === null) {
    assert.ok(!action('csv') && !action('copy-csv'), `${analysisId}: settings-only examples must not offer CSV controls.`);
  }
}

for (const analysisId of Object.keys(api.analyses)) {
  go('#/analysis/' + analysisId);
  checkAnalysisPage(analysisId);
  if (!api.analysisMedia(api.analyses[analysisId]).jasp) {
    const hashBefore = location.hash;
    const csvBefore = queryAll('[data-action="csv"]').length;
    await click(action('jasp-unavailable', analysisId));
    assert.equal(location.hash, hashBefore, `${analysisId}: missing-file notice must not change the page.`);
    const toast = document.getElementById('toast');
    assert.equal(toast.textContent, 'The annotated JASP file for this analysis is coming soon.');
    assert.ok(toast.attrs.class.split(/\s+/).includes('show'), `${analysisId}: missing-file notice must become visible.`);
    assert.equal(toast.attrs.role, 'status', `${analysisId}: notice must be exposed as a status message.`);
    assert.equal(toast.attrs['aria-live'], 'polite', `${analysisId}: notice must be announced without interrupting.`);
    assert.equal(queryAll('[download]').length, 0, `${analysisId}: notification must not introduce a download.`);
    assert.equal(queryAll('[data-action="csv"]').length, csvBefore, `${analysisId}: notification must preserve CSV controls.`);
  }
}
for (const [scenarioId, scenario] of Object.entries(api.scenarios)) {
  go('#/case/' + scenarioId + '/' + scenario.picks.join('/'));
  checkAnalysisPage(scenario.result, scenario);
  const plan = api.planText();
  assert.ok(plan.includes(scenario.title) && plan.includes(scenario.description), `${scenarioId}: plan lost scenario context.`);
  for (const instruction of api.analyses[scenario.result].example.instructions) {
    assert.ok(plan.includes(instruction), `${scenarioId}: plan lost example input instructions.`);
  }
  const jasp = api.analysisMedia(api.analyses[scenario.result]).jasp;
  if (jasp) assert.ok(plan.includes(jasp.note), `${scenarioId}: plan lost the JASP resource note.`);
  else assert.match(plan, /annotated JASP file[^\n]*coming soon/i, `${scenarioId}: plan must identify the pending annotated JASP file.`);
  assert.ok(scenario.sample ? plan.includes('Sample: ' + scenario.sample + '.csv') : plan.includes('Settings-only example:'),
    `${scenarioId}: plan does not identify the correct example input.`);
}

// Exercise the browser source-selection contracts with real Blob bytes. This
// models acceptance/rejection only; it cannot establish browser video playback.
const embeddedMedia = JSON.parse(dataText).media;
const availableMedia = structuredClone(embeddedMedia);
availableMedia.assets['test-video'] = videoFixture;
availableMedia.defaults.video = 'test-video';
// Keep both shared-video routes independent of real per-analysis media.
availableMedia.analyses.imr = {...availableMedia.analyses.imr, video: 'test-video'};
availableMedia.analyses.one_t = {...availableMedia.analyses.one_t, video: 'test-video'};
for (const mode of ['supported', 'throws', 'absent']) {
  const mediaRuntime = boot('#/analysis/imr', 0, mode, availableMedia);
  const player = mediaRuntime.document.getElementById('analysis-video');
  const selected = videoFixture;
  const assignedBlob = player.srcObject;
  assert.equal(player.markupSrc, undefined, `${mode}: video must start without a markup source.`);
  if (mode === 'supported') {
    assert.ok(assignedBlob instanceof Blob, 'A browser accepting Blob srcObject must receive a Blob.');
    assert.equal(assignedBlob.type, 'video/mp4');
    assert.deepEqual(Buffer.from(await assignedBlob.arrayBuffer()), Buffer.from(selected.src.split(',')[1], 'base64'),
      'Blob source bytes must exactly match the embedded video.');
    assert.equal(player.src, undefined, 'An accepted Blob must not also assign the data-URI source.');
    assert.ok(!mediaRuntime.mediaEvents.some(event => event.type === 'src'),
      'An accepted Blob must not trigger a second source assignment.');
  } else {
    assert.equal(player.src, selected.src, `${mode}: retain the original data-URI playback path.`);
    assert.equal(mediaRuntime.mediaEvents.filter(event => event.type === 'src').length, 1,
      `${mode}: attach the fallback source only once.`);
  }
  assert.equal(vm.runInContext('JSON.stringify(DATA.media)', mediaRuntime.sandbox), JSON.stringify(availableMedia),
    `${mode}: runtime video attachment must preserve offline media data.`);

  mediaRuntime.mediaEvents.length = 0;
  mediaRuntime.location.hash = '#/analysis/one_t';
  mediaRuntime.windowEvents.hashchange();
  const released = mediaRuntime.mediaEvents.filter(event => event.element === player);
  assert.deepEqual(released.map(event => event.type),
    mode === 'absent' ? ['pause', 'removeSrc', 'load'] : ['pause', 'srcObject', 'removeSrc', 'load'],
    `${mode}: leaving an analysis must stop and detach its old video.`);
  assert.ok(released.every(event => event.mounted), `${mode}: release the old video before replacing its DOM.`);
  assert.equal(player.src, undefined, `${mode}: release must clear the old source.`);
  if (mode !== 'absent') assert.equal(player.srcObject, null, `${mode}: release must clear srcObject.`);

  if (mode === 'supported') {
    assert.equal(mediaRuntime.document.getElementById('analysis-video').srcObject, assignedBlob,
      'Analyses sharing a video should reuse its decoded Blob.');
    const media = vm.runInContext('DATA.media', mediaRuntime.sandbox);
    media.assets['interface-video'] = {...selected, src: 'data:video/mp4;base64,AP+ADQ=='};
    media.analyses.imr = {...media.analyses.imr, video: 'interface-video'};
    mediaRuntime.location.hash = '#/analysis/imr';
    mediaRuntime.windowEvents.hashchange();
    const replacement = mediaRuntime.document.getElementById('analysis-video').srcObject;
    assert.notEqual(replacement, assignedBlob, 'A video override must replace the cached Blob.');
    assert.equal(replacement.type, 'video/mp4');
    assert.deepEqual(Buffer.from(await replacement.arrayBuffer()), Buffer.from([0, 255, 128, 13]),
      'A selected video override must supply its own bytes.');
    assert.equal(JSON.stringify(api.media), JSON.stringify(embeddedMedia),
      'An isolated video fixture must not alter the main test data.');
  }
  const media = vm.runInContext('DATA.media', mediaRuntime.sandbox);
  media.analyses.imr = {...media.analyses.imr, video: null};
  mediaRuntime.location.hash = '#/analysis/imr';
  mediaRuntime.windowEvents.hashchange();
  assert.equal(mediaRuntime.document.getElementById('analysis-video'), null,
    `${mode}: explicit null must replace an inherited video with the placeholder.`);
  assert.equal(mediaRuntime.queryAll('.video-placeholder').length, 1);
}

// Collect one reachable route per question/prerequisite. Full route semantics
// belong to validate.mjs; here each distinct presentation is checked for loss
// of its wording and usable answer/reference controls after layout changes.
const questionRoutes = new Map(), guardRoutes = new Map();
function collectRoutes(goal, picks = [], ancestors = new Set()) {
  const context = api.walk(goal, picks);
  const hash = '#/guide/' + goal + (picks.length ? '/' + picks.join('/') : '');
  if (context.current.startsWith('g:')) {
    if (!guardRoutes.has(context.current.slice(2))) guardRoutes.set(context.current.slice(2), hash);
    return;
  }
  const question = api.questions[context.current];
  if (!question) return;
  assert.ok(!ancestors.has(context.current), 'Question traversal must not cycle.');
  if (!questionRoutes.has(context.current)) questionRoutes.set(context.current, hash);
  const nextAncestors = new Set(ancestors).add(context.current);
  for (const option of question.options) collectRoutes(goal, [...picks, option.value], nextAncestors);
}
for (const goal of Object.keys(api.goals)) collectRoutes(goal);
assert.equal(questionRoutes.size, Object.keys(api.questions).length, 'Every question must be available for presentation checks.');
assert.equal(guardRoutes.size, Object.keys(api.guards).length, 'Every preparation outcome must be available for presentation checks.');
for (const [id, hash] of questionRoutes) {
  go(hash);
  const question = api.questions[id];
  assert.equal(document.getElementById('page-title').textContent, question.title);
  assert.ok(document.getElementById('page-title').closest('.question-panel'),
    `${id}: the question title must stay with its answer workspace.`);
  for (const text of [question.description, ...question.help]) includesText(app, text, id);
  const answers = queryAll('[data-action="answer"]');
  assert.equal(answers.length, question.options.length, `${id}: answer choices were lost or duplicated.`);
  for (const option of question.options) {
    const control = action('answer', option.value);
    includesText(control, option.label, id + ': answer label');
    includesText(control, option.description, id + ': answer explanation');
  }
}
for (const [id, hash] of guardRoutes) {
  go(hash);
  const guard = api.guards[id];
  assert.equal(document.getElementById('page-title').textContent, guard.title);
  for (const text of [guard.summary, ...guard.steps]) includesText(app, text, id);
  includesText(app, 'No JASP analysis has been selected for this path yet.', id);
  assert.equal(count('video'), 0, `${id}: prerequisite must not acquire an analysis video.`);
  for (const goal of guard.goals || []) includesText(action('start', goal), api.goals[goal].title, id + ': goal action');
  for (const analysis of guard.analyses || []) includesText(action('analysis', analysis), api.analyses[analysis].title, id + ': reference action');
  for (const reference of guard.sources || []) sourcePresent(api.references[reference], id);
}

go('#/');
for (const [id, goal] of Object.entries(api.goals)) {
  const control = action('start', id);
  includesText(control, goal.title, id + ': home goal');
  includesText(control, goal.description, id + ': home explanation');
}
assert.ok(action('case', 'filling'), 'Home must retain its featured worked-example action.');
assert.ok(queryAll('[href]').some(link => link.attrs.href === '#/analyses'), 'Home must retain catalogue navigation.');

go('#/examples');
for (const [id, scenario] of Object.entries(api.scenarios)) {
  for (const text of [scenario.title, scenario.description, scenario.lesson]) includesText(app, text, id + ': example catalogue');
  assert.ok(action('case', id), `${id}: featured-example navigation is missing.`);
  if (scenario.sample) assert.ok(action('csv', scenario.sample), `${id}: example catalogue lost its dataset download.`);
}

// Starting from a deep link must respect the browser's own initial position
// and focus, just as the home page does. Later navigation is tested below.
for (const hash of ['#/guide/monitor/continuous', '#/analysis/imr']) {
  const initial = boot(hash, 375);
  assert.equal(initial.scrollEvents.length, 0, `${hash}: initial load must not override restored scroll.`);
  assert.equal(initial.window.scrollY, 375);
  assert.equal(initial.focusEvents.length, 0, `${hash}: initial load must not steal focus.`);
  assert.ok(initial.document.getElementById('page-title'), `${hash}: initial route must render its heading.`);
}

function prepareViewport(scrollY, titleY = 300) {
  window.scrollY = scrollY;
  geometry.titleY = titleY;
  geometry.titleHeight = 70;
  scrollEvents.length = 0;
  focusEvents.length = 0;
}
function headingFocused(context) {
  const focused = focusEvents.at(-1);
  assert.ok(focused && focused.element === document.getElementById('page-title'),
    `${context}: navigation must focus the new question/outcome heading.`);
  assert.equal(focused.options?.preventScroll, true,
    `${context}: heading focus must not cause its own browser scroll.`);
}
function viewportPreserved(scrollY, context) {
  assert.equal(scrollEvents.length, 0, `${context}: an already-visible heading must not trigger scrolling.`);
  assert.equal(window.scrollY, scrollY, `${context}: navigation reset the reader's position.`);
  headingFocused(context);
}
function headingRevealed(context) {
  assert.equal(scrollEvents.length, 1, `${context}: an off-screen heading should be revealed once.`);
  assert.ok(window.scrollY > 0, `${context}: reveal the workspace, not the document top.`);
  const rect = document.getElementById('page-title').getBoundingClientRect();
  assert.ok(rect.top >= 0 && rect.bottom <= window.innerHeight,
    `${context}: adjusted viewport does not include the heading.`);
  headingFocused(context);
}
function pageTop(context) {
  assert.equal(scrollEvents.length, 1, `${context}: the recommended analysis must scroll to the page top once.`);
  assert.equal(scrollEvents[0].top, 0, `${context}: the requested destination must be the page top.`);
  assert.equal(window.scrollY, 0, `${context}: the recommended analysis must begin at the page top.`);
  headingFocused(context);
}

// Real delegated goal/answer/back/edit actions must preserve a comfortable
// viewport, or bring only the new workspace into view when it is off screen.
go('#/');
prepareViewport(150);
await click(action('start', 'monitor'));
viewportPreserved(150, 'Enter a guide with its question already visible');
prepareViewport(150);
await click(action('answer', 'continuous'));
viewportPreserved(150, 'Answer progression');
assert.ok(document.title.includes(api.questions.m_order.title) && document.title.includes('Question 2'),
  'Browser title should identify the current question and its step.');
prepareViewport(150);
await click(action('back'));
viewportPreserved(150, 'Previous question');

prepareViewport(500);
await click(action('answer', 'continuous'));
headingRevealed('Answer progression with heading above viewport');
prepareViewport(100, 1000);
await click(action('back'));
headingRevealed('Previous question with heading below viewport');

go('#/guide/monitor/continuous/ordered/individual/general');
prepareViewport(150);
await click(action('edit', '1'));
viewportPreserved(150, 'Edit an earlier answer from the result');
go('#/guide/monitor/continuous/ordered/individual/general');
prepareViewport(500);
await click(action('edit', '1'));
headingRevealed('Edit an earlier answer from outside the workspace');

prepareViewport(150);
await click(action('answer', 'unknown'));
viewportPreserved(150, 'Preparation outcome');
go('#/guide/monitor/continuous');
prepareViewport(500);
await click(action('answer', 'unknown'));
headingRevealed('Preparation outcome outside the viewport');

go('#/guide/monitor/continuous/ordered/individual');
prepareViewport(150);
await click(action('answer', 'general'));
pageTop('Recommended analysis with heading already visible');
prepareViewport(150);
await click(action('back'));
assert.equal(location.hash, '#/guide/monitor/continuous/ordered/individual',
  'Back from a recommended analysis must return to its final question.');
viewportPreserved(150, 'Back from recommended analysis');
go('#/guide/monitor/continuous/ordered/individual');
prepareViewport(500);
await click(action('answer', 'general'));
pageTop('Recommended analysis with heading outside the viewport');

go('#/analyses');
prepareViewport(150);
await click(action('analysis', 'imr'));
viewportPreserved(150, 'Direct analysis navigation');
go('#/analyses');
prepareViewport(100, 1000);
await click(action('analysis', 'imr'));
headingRevealed('Direct analysis navigation with heading below viewport');

// Hash changes model browser history navigation without imposing a separate
// global restoration policy on the real browser.
prepareViewport(150);
go('#/guide/monitor/continuous');
viewportPreserved(150, 'History navigation into a guide');
prepareViewport(500);
go('#/about');
assert.equal(scrollEvents.length, 1, 'A different top-level page should deliberately reset its position.');
assert.equal(window.scrollY, 0, 'Top-level navigation should start at the page top.');
headingFocused('Top-level page navigation');
geometry.titleY = 220;

// Real delegated navigation: revise an earlier answer, then reach a prerequisite.
go('#/case/filling/continuous/ordered/individual/abrupt');
await click(action('edit', '1'));
assert.equal(location.hash, '#/case/filling/continuous', 'Editing an earlier answer must discard later answers.');
assert.ok(!count('video') && action('answer', 'unknown'), 'Editing should return to the corresponding question.');
await click(action('answer', 'unknown'));
assert.ok(app.textContent.includes('No JASP analysis has been selected'), 'Missing time order must show a preparation outcome.');
assert.equal(count('video'), 0, 'Preparation outcomes must not look like selected analyses.');
uniqueIds('preparation outcome');

go('#/analysis/imr');
await click(action('tab', 'example'));
assert.equal(document.getElementById('panel-example').hidden, false);
assert.equal(document.getElementById('panel-setup').hidden, true);
documentEvents.keydown({target: document.getElementById('tab-example'), key: 'ArrowRight', preventDefault() {}});
assert.equal(document.getElementById('tab-checks').attrs['aria-selected'], 'true');
assert.equal(document.getElementById('panel-checks').hidden, false);

// Print should expose supporting details, then restore the reader's choices.
const printDetails = queryAll('.sources,.analysis-context,.availability-note');
assert.ok(printDetails.length >= 3, 'Expected sources, rationale, and availability details.');
printDetails.forEach((detail, index) => { detail.open = index % 2 === 0; });
const openBeforePrint = printDetails.map(detail => detail.open);
windowEvents.beforeprint();
assert.ok(printDetails.every(detail => detail.open), 'Printing must open all supporting details.');
windowEvents.afterprint();
assert.deepEqual(printDetails.map(detail => detail.open), openBeforePrint,
  'After printing, mixed open/closed detail states must be restored.');

// Search and family filters operate on the actual catalogue rendering.
go('#/analyses');
await click(action('filter', 'monitor'));
assert.equal(queryAll('.analysis-card').length, 9, 'Monitoring filter should show nine charts.');
const search = document.getElementById('analysis-search');
search.value = 'moving range';
documentEvents.input({target: search});
assert.deepEqual(queryAll('.analysis-card').map(node => node.dataset.value), ['imr']);
search.value = 'no-such-method-xyz';
documentEvents.input({target: search});
assert.equal(count('.analysis-card'), 0);
assert.ok(document.getElementById('catalog-results').textContent.includes('No matching analysis'));
await click(action('clear-search'));
assert.equal(count('.analysis-card'), Object.keys(api.analyses).length);

// Available/missing combinations must preserve the other resource and neighbouring analyses.
const defaultsBefore = JSON.stringify(api.media.defaults);
const originalOverride = api.media.analyses.imr;
api.media.assets['test-specific-jasp'] = jaspFixture;
api.media.assets['test-specific-video'] = videoFixture;
for (const [video, jasp] of [[null, null], ['test-specific-video', null], [null, 'test-specific-jasp'], ['test-specific-video', 'test-specific-jasp']]) {
  api.media.analyses.imr = {video, jasp};
  go('#/analysis/imr');
  checkAnalysisPage('imr');
  assert.equal(queryAll('video').length, video ? 1 : 0);
  assert.equal(queryAll('[download]').length, jasp ? 1 : 0);
  const plan = api.planText();
  if (jasp) assert.ok(plan.includes(jaspFixture.note), 'Available JASP resource note must remain in the exported plan.');
  else assert.match(plan, /annotated JASP file[^\n]*coming soon/i, 'Missing JASP resource must remain explicit in the exported plan.');
  go('#/analysis/one_t');
  checkAnalysisPage('one_t');
  assert.equal(JSON.stringify(api.media.defaults), defaultsBefore, 'Per-analysis overrides must not mutate shared defaults.');
}
// A partial override inherits a default resource; explicit null suppresses it.
api.media.defaults.video = 'test-specific-video';
api.media.defaults.jasp = 'test-specific-jasp';
api.media.analyses.imr = {jasp: null};
go('#/analysis/imr');
checkAnalysisPage('imr');
assert.equal(queryAll('video').length, 1, 'Partial override must retain the available default video.');
assert.equal(queryAll('[download]').length, 0, 'Explicit null must suppress an available default JASP file.');
api.media.analyses.imr = {video: null};
go('#/analysis/imr');
checkAnalysisPage('imr');
assert.equal(queryAll('video').length, 0, 'Explicit null must suppress an available default video.');
assert.equal(queryAll('[download]').length, 1, 'Partial override must retain the available default JASP file.');
Object.assign(api.media.defaults, JSON.parse(defaultsBefore));
if (originalOverride === undefined) delete api.media.analyses.imr; else api.media.analyses.imr = originalOverride;
delete api.media.assets['test-specific-jasp'];
delete api.media.assets['test-specific-video'];

for (const route of ['#/', '#/examples', '#/about']) { go(route); uniqueIds(route); }
console.log(`PASS: Source-render preservation checks for ${Object.keys(api.analyses).length} analysis pages, ${Object.keys(api.scenarios).length} scenarios, ${questionRoutes.size} questions, and ${guardRoutes.size} prerequisites; media placement, links, tabs, scroll/focus intent, navigation, search, plans, missing-resource notices, and resource overrides.`);
console.log('NOT browser QA: layout, playback, download behavior, accessibility interaction, and desktop JASP remain unverified.');
