'use strict';

const assert  = require('assert');
const fixture = require('./fixtures/sampleFigmaResponse.json');
const { normalize } = require('../src/normalizers/normalizer');
const { render }    = require('../src/renderers/markdownRenderer');

const doc = normalize(fixture, {});

// ── Full document render ──────────────────────────────────────────────────────
{
  const md = render(doc, { includeNodeIds: true, includeThumbnails: false });

  assert.strictEqual(typeof md, 'string', 'render returns a string');
  assert.ok(md.length > 0, 'output is non-empty');

  // Title
  assert.ok(md.includes('# My Design System'), 'title heading present');

  // Meta
  assert.ok(md.includes('Last modified'), 'last modified present');
  assert.ok(md.includes('Version'), 'version present');

  // TOC
  assert.ok(md.includes('## Table of Contents'), 'TOC present');
  assert.ok(md.includes('File Stats'), 'file stats link in TOC');

  // Stats table
  assert.ok(md.includes('## File Stats'), 'stats section present');
  assert.ok(md.includes('| Pages |'), 'pages row present');
  assert.ok(md.includes('| Frames |'), 'frames row present');
  assert.ok(md.includes('| Interactions |'), 'interactions row present');

  // Pages
  assert.ok(md.includes('## Page: Page 1'), 'page heading present');
  assert.ok(md.includes('Home Screen'), 'frame name present');
  assert.ok(md.includes('Detail Screen'), 'detail frame present');
  assert.ok(md.includes('375 × 812 px'), 'frame dimensions present');

  // Auto layout
  assert.ok(md.includes('Auto Layout'), 'auto layout annotation present');

  // Prototype flows
  assert.ok(md.includes('### Prototype Flows'), 'flows section present');
  assert.ok(md.includes('Main Flow'), 'flow name present');

  // Interactions
  assert.ok(md.includes('## Interactions'), 'interactions section present');
  assert.ok(md.includes('ON_CLICK'), 'trigger type present');

  // Components
  assert.ok(md.includes('## Components'), 'components section present');
  assert.ok(md.includes('Button'), 'component name present');
  assert.ok(md.includes('Button/Primary'), 'variant present');

  // Design styles
  assert.ok(md.includes('## Design Styles'), 'styles section present');
  assert.ok(md.includes('FILL'), 'fill style present');
  assert.ok(md.includes('TEXT'), 'text style present');

  // Node IDs (because includeNodeIds=true)
  assert.ok(md.includes('10:1'), 'node ID present');

  console.log('✅  render (full) — all assertions passed');
}

// ── Per-page render ───────────────────────────────────────────────────────────
{
  const pages = render(doc, { perPage: true, includeNodeIds: false });

  assert.strictEqual(typeof pages, 'object', 'perPage returns object');
  assert.ok(Object.keys(pages).length >= 1, 'at least 1 page key');
  assert.ok(pages['Page 1'], 'Page 1 key present');
  assert.ok(typeof pages['Page 1'] === 'string', 'page value is string');
  assert.ok(pages['Page 1'].includes('Home Screen'), 'page contains frame');

  console.log('✅  render (perPage) — all assertions passed');
}

// ── No node IDs ───────────────────────────────────────────────────────────────
{
  const md = render(doc, { includeNodeIds: false });
  assert.ok(!md.includes('`10:1`'), 'node IDs absent when includeNodeIds=false');
  console.log('✅  render (no nodeIds) — all assertions passed');
}

// ── Empty document graceful handling ─────────────────────────────────────────
{
  const emptyDoc = {
    meta: { name: 'Empty', lastModified: null, version: null, role: null, editorType: 'figma' },
    pages: [],
    frames: [],
    text: [],
    layout: [],
    interactions: [],
    flows: [],
    styles: [],
    stats: { pageCount: 0, frameCount: 0, textCount: 0, interactionCount: 0, flowCount: 0, styleCount: 0 },
  };
  const md = render(emptyDoc);
  assert.strictEqual(typeof md, 'string', 'empty doc renders without error');
  assert.ok(md.includes('# Empty'), 'title from empty doc');
  console.log('✅  render (empty doc) — all assertions passed');
}

console.log('\n🎉  All markdownRenderer tests passed!\n');
