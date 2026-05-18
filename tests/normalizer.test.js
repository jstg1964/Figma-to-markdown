'use strict';

const assert  = require('assert');
const fixture = require('./fixtures/sampleFigmaResponse.json');
const { normalize } = require('../src/normalizers/normalizer');

// Full normalisation with all extractors enabled
const doc = normalize(fixture, {}, {
  includeLayout: true,
  includeInteractions: true,
  includeText: true,
  includeComponents: true,
  includeFlows: true,
});

// ── meta ─────────────────────────────────────────────────────────────────────
assert.strictEqual(doc.meta.name, 'My Design System', 'meta.name correct');
assert.strictEqual(doc.meta.version, '42', 'meta.version correct');
assert.ok(doc.meta.lastModified, 'meta.lastModified present');
console.log('✅  meta — OK');

// ── pages ────────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.pages), 'pages is array');
assert.strictEqual(doc.pages.length, 2, 'two pages');
assert.strictEqual(doc.pages[0].name, 'Page 1');
assert.ok(doc.pages[0].flowStartingPoints.length >= 1, 'flow starting points present');
console.log('✅  pages — OK');

// ── frames ───────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.frames), 'frames is array');
assert.ok(doc.frames.length >= 2, 'at least 2 frames');
console.log('✅  frames — OK');

// ── components ───────────────────────────────────────────────────────────────
assert.ok(doc.components, 'components present');
assert.ok(Array.isArray(doc.components.definitions), 'definitions array');
assert.ok(Array.isArray(doc.components.instances), 'instances array');
assert.ok(doc.components.definitions.length >= 2);
assert.ok(doc.components.instances.length >= 1);
console.log('✅  components — OK');

// ── text ─────────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.text), 'text is array');
assert.ok(doc.text.length >= 1, 'at least 1 text node');
console.log('✅  text — OK');

// ── layout ───────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.layout), 'layout is array');
assert.ok(doc.layout.length >= 1);
console.log('✅  layout — OK');

// ── interactions ──────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.interactions), 'interactions is array');
assert.ok(doc.interactions.length >= 1);
console.log('✅  interactions — OK');

// ── flows ─────────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.flows), 'flows is array');
assert.ok(doc.flows.length >= 1);
console.log('✅  flows — OK');

// ── styles ────────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(doc.styles), 'styles is array');
assert.ok(doc.styles.length >= 2);
assert.ok(doc.styles.some((s) => s.styleType === 'FILL'), 'FILL style present');
assert.ok(doc.styles.some((s) => s.styleType === 'TEXT'), 'TEXT style present');
console.log('✅  styles — OK');

// ── stats ─────────────────────────────────────────────────────────────────────
assert.ok(doc.stats, 'stats present');
assert.strictEqual(doc.stats.pageCount, 2, 'stats.pageCount = 2');
assert.ok(doc.stats.frameCount >= 2);
assert.ok(doc.stats.textCount >= 1);
assert.ok(doc.stats.interactionCount >= 1);
assert.ok(doc.stats.flowCount >= 1);
console.log('✅  stats — OK');

// ── partial normalisation (opt-out) ──────────────────────────────────────────
const partial = normalize(fixture, {}, {
  includeLayout: false,
  includeInteractions: false,
  includeText: false,
  includeComponents: false,
  includeFlows: false,
});
assert.strictEqual(partial.layout, undefined, 'layout excluded when opt=false');
assert.strictEqual(partial.interactions, undefined, 'interactions excluded');
assert.strictEqual(partial.text, undefined, 'text excluded');
assert.strictEqual(partial.components, undefined, 'components excluded');
assert.strictEqual(partial.flows, undefined, 'flows excluded');
console.log('✅  partial normalisation — OK');

console.log('\n🎉  All normalizer tests passed!\n');
