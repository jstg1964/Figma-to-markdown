'use strict';

const assert = require('assert');
const fixture = require('./fixtures/sampleFigmaResponse.json');

const { extractFrames }       = require('../src/extractors/frameExtractor');
const { extractComponents }   = require('../src/extractors/componentExtractor');
const { extractText }         = require('../src/extractors/textExtractor');
const { extractLayout }       = require('../src/extractors/layoutExtractor');
const { extractInteractions } = require('../src/extractors/interactionExtractor');
const { extractFlows }        = require('../src/extractors/flowExtractor');

const doc = fixture.document;

// ── extractFrames ────────────────────────────────────────────────────────────
{
  const frames = extractFrames(doc);

  assert.ok(Array.isArray(frames), 'extractFrames returns an array');
  assert.ok(frames.length >= 2, `expected >= 2 top-level frames, got ${frames.length}`);

  const home = frames.find((f) => f.name === 'Home Screen');
  assert.ok(home, 'Home Screen frame found');
  assert.strictEqual(home.type, 'FRAME');
  assert.strictEqual(home.size.width, 375);
  assert.strictEqual(home.size.height, 812);
  assert.strictEqual(home.layoutMode, 'VERTICAL');
  assert.strictEqual(home.itemSpacing, 16);
  assert.ok(home.background, 'Home screen has background');
  assert.strictEqual(home.background.color, '#ffffff');

  const detail = frames.find((f) => f.name === 'Detail Screen');
  assert.ok(detail, 'Detail Screen frame found');

  console.log('✅  extractFrames — all assertions passed');
}

// ── extractComponents ────────────────────────────────────────────────────────
{
  const { definitions, instances } = extractComponents(
    doc,
    fixture.components,
    fixture.componentSets
  );

  assert.ok(Array.isArray(definitions), 'definitions is array');
  assert.ok(definitions.length >= 2, `expected >= 2 definitions, got ${definitions.length}`);

  const set = definitions.find((d) => d.type === 'COMPONENT_SET');
  assert.ok(set, 'Component set found');
  assert.strictEqual(set.name, 'Button');

  const comp = definitions.find((d) => d.type === 'COMPONENT');
  assert.ok(comp, 'Component found');
  assert.strictEqual(comp.name, 'Button/Primary');

  assert.ok(Array.isArray(instances), 'instances is array');
  assert.ok(instances.length >= 1, `expected >= 1 instance, got ${instances.length}`);
  assert.strictEqual(instances[0].componentId, 'C:1');

  console.log('✅  extractComponents — all assertions passed');
}

// ── extractText ──────────────────────────────────────────────────────────────
{
  const texts = extractText(doc);

  assert.ok(Array.isArray(texts), 'extractText returns array');
  assert.ok(texts.length >= 1, `expected >= 1 text node, got ${texts.length}`);

  const title = texts.find((t) => t.characters === 'Welcome Back');
  assert.ok(title, 'Title text node found');
  assert.strictEqual(title.fontFamily, 'Inter');
  assert.strictEqual(title.fontWeight, 700);
  assert.strictEqual(title.fontSize, 28);
  assert.strictEqual(title.color, '#1a1a1a');

  console.log('✅  extractText — all assertions passed');
}

// ── extractLayout ────────────────────────────────────────────────────────────
{
  const layouts = extractLayout(doc);

  assert.ok(Array.isArray(layouts), 'extractLayout returns array');
  assert.ok(layouts.length >= 1, `expected >= 1 layout, got ${layouts.length}`);

  const homeLayout = layouts.find((l) => l.name === 'Home Screen');
  assert.ok(homeLayout, 'Home Screen layout found');
  assert.ok(homeLayout.autoLayout, 'auto-layout present');
  assert.strictEqual(homeLayout.autoLayout.direction, 'VERTICAL');
  assert.strictEqual(homeLayout.autoLayout.gap, 16);

  console.log('✅  extractLayout — all assertions passed');
}

// ── extractInteractions ──────────────────────────────────────────────────────
{
  const interactions = extractInteractions(doc);

  assert.ok(Array.isArray(interactions), 'extractInteractions returns array');
  assert.ok(interactions.length >= 1, `expected >= 1 interaction, got ${interactions.length}`);

  const ix = interactions[0];
  assert.strictEqual(ix.sourceNodeName, 'Home Screen');
  assert.strictEqual(ix.trigger.type, 'ON_CLICK');
  assert.strictEqual(ix.action.type, 'NODE');
  assert.strictEqual(ix.action.destinationId, '10:2');
  assert.ok(ix.action.transition, 'transition present');
  assert.strictEqual(ix.action.transition.type, 'SMART_ANIMATE');

  console.log('✅  extractInteractions — all assertions passed');
}

// ── extractFlows ─────────────────────────────────────────────────────────────
{
  const flows = extractFlows(fixture);

  assert.ok(Array.isArray(flows), 'extractFlows returns array');
  assert.ok(flows.length >= 1, `expected >= 1 flow, got ${flows.length}`);

  const flow = flows[0];
  assert.strictEqual(flow.flowName, 'Main Flow');
  assert.strictEqual(flow.startNodeId, '10:1');
  assert.ok(flow.graph, 'flow graph present');
  assert.ok(Array.isArray(flow.graph.nodes), 'graph.nodes is array');
  assert.ok(flow.graph.nodes.length >= 2, 'graph has >= 2 nodes');
  assert.ok(flow.graph.edges.length >= 1, 'graph has >= 1 edge');

  const edge = flow.graph.edges[0];
  assert.strictEqual(edge.from, '10:1');
  assert.strictEqual(edge.to, '10:2');
  assert.strictEqual(edge.trigger, 'ON_CLICK');

  console.log('✅  extractFlows — all assertions passed');
}

console.log('\n🎉  All extractor tests passed!\n');
