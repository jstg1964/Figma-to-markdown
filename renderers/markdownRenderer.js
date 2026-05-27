'use strict';

const { slugify, truncate, colorToCSS } = require('../utils/helpers');
const { config } = require('../config');

/**
 * Apply component name mapping if enabled
 */
function _applyMapping(name) {
  if (!config.componentMapping.enabled) return name;
  return config.componentMapping.mapping[name] || name;
}

/**
 * Render a normalised Figma document (output of normalizer.normalize()) into
 * a single Markdown string, or a map of per-page Markdown strings.
 *
 * @param {object} doc       - Normalised document from normalize()
 * @param {object} [opts]
 * @param {boolean} [opts.perPage=false]  - Return a { pageName: mdString } map instead
 * @param {boolean} [opts.includeNodeIds] - Annotate headings with node IDs
 * @param {boolean} [opts.includeThumbnails] - Embed thumbnail URLs as images
 * @param {number}  [opts.maxDepth]       - Maximum frame nesting depth to render
 * @returns {string | object}
 */
function render(doc, opts = {}) {
  const {
    perPage = false,
    includeNodeIds = config.markdown.includeNodeIds,
    includeThumbnails = config.markdown.includeThumbnailUrls,
    maxDepth = config.markdown.maxDepth,
  } = opts;

  const ctx = { includeNodeIds, includeThumbnails, maxDepth };

  if (perPage) {
    const pages = {};
    for (const page of (doc.pages || [])) {
      const pageFrames = (doc.frames || []).filter((f) => f.pageId === page.id);
      const pageInteractions = (doc.interactions || []);
      const pageFlows = (doc.flows || []).filter((f) => f.pageId === page.id);
      pages[page.name] = _renderPage(doc, page, pageFrames, pageInteractions, pageFlows, ctx);
    }
    return pages;
  }

  return _renderFull(doc, ctx);
}

// ---------------------------------------------------------------------------
// Full document render
// ---------------------------------------------------------------------------

function _renderFull(doc, ctx) {
  const lines = [];

  // Title
  lines.push(`# ${doc.meta.name || 'Figma File'}`);
  lines.push('');
  lines.push(_renderMeta(doc.meta, ctx));
  lines.push('');
  lines.push(_renderTOC(doc));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Stats
  lines.push(_renderStats(doc.stats));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Pages
  for (const page of (doc.pages || [])) {
    const pageFrames = (doc.frames || []).filter((f) => f.pageId === page.id);
    const pageFlows = (doc.flows || []).filter((f) => f.pageId === page.id);
    lines.push(_renderPage(doc, page, pageFrames, doc.interactions || [], pageFlows, ctx));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Components
  if (doc.components) {
    lines.push(_renderComponents(doc.components, ctx));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Styles / Design tokens
  if (doc.styles && doc.styles.length > 0) {
    lines.push(_renderStyles(doc.styles));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // All interactions (global table)
  if (doc.interactions && doc.interactions.length > 0) {
    lines.push(_renderInteractionsGlobal(doc.interactions));
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Meta block
// ---------------------------------------------------------------------------

function _renderMeta(meta, ctx) {
  const lines = [];
  if (meta.lastModified) lines.push(`> **Last modified:** ${meta.lastModified}`);
  if (meta.version)      lines.push(`> **Version:** ${meta.version}`);
  if (meta.role)         lines.push(`> **Role:** ${meta.role}`);
  if (meta.editorType)   lines.push(`> **Editor:** ${meta.editorType}`);
  if (meta.thumbnailUrl && ctx.includeThumbnails) {
    lines.push('');
    lines.push(`![File thumbnail](${meta.thumbnailUrl})`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

function _renderTOC(doc) {
  const lines = ['## Table of Contents', ''];
  lines.push('- [File Stats](#file-stats)');

  for (const page of (doc.pages || [])) {
    const slug = slugify(page.name);
    lines.push(`- [${page.name}](#page-${slug})`);
  }

  if (doc.components?.definitions?.length) lines.push('- [Components](#components)');
  if (doc.styles?.length)                  lines.push('- [Design Styles](#design-styles)');
  if (doc.interactions?.length)            lines.push('- [Interactions](#interactions)');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function _renderStats(stats) {
  if (!stats) return '';
  const lines = ['## File Stats', ''];
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Pages | ${stats.pageCount} |`);
  lines.push(`| Frames | ${stats.frameCount} |`);
  lines.push(`| Component Definitions | ${stats.componentDefinitionCount} |`);
  lines.push(`| Component Instances | ${stats.componentInstanceCount} |`);
  lines.push(`| Text Nodes | ${stats.textCount} |`);
  lines.push(`| Interactions | ${stats.interactionCount} |`);
  lines.push(`| Prototype Flows | ${stats.flowCount} |`);
  lines.push(`| Design Styles | ${stats.styleCount} |`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Page render
// ---------------------------------------------------------------------------

function _renderPage(doc, page, frames, interactions, flows, ctx) {
  const slug = slugify(page.name);
  const lines = [];

  lines.push(`## Page: ${page.name} {#page-${slug}}`);
  lines.push('');
  if (page.childCount !== undefined) lines.push(`> **Top-level nodes:** ${page.childCount}`);
  if (page.flowStartingPoints?.length) {
    const fps = page.flowStartingPoints.map((f) => f.name || f.nodeId).join(', ');
    lines.push(`> **Prototype entry points:** ${fps}`);
  }
  lines.push('');

  // Summary of top-level elements
  const topLevelFrames = frames.filter((f) => f.depth === 0);
  if (topLevelFrames.length > 0) {
    lines.push('### Top-Level Elements');
    lines.push('');
    lines.push('| Name | Type | Size | Children |');
    lines.push('|------|------|------|----------|');
    for (const frame of topLevelFrames) {
      const size = frame.size ? `${frame.size.width}×${frame.size.height}` : '—';
      lines.push(`| ${_applyMapping(frame.name)} | ${frame.type} | ${size} | ${frame.childCount} |`);
    }
    lines.push('');
  }

  // Frames
  if (frames.length > 0) {
    lines.push(`### Frames (${frames.length})`);
    lines.push('');
    for (const frame of frames) {
      lines.push(_renderFrame(frame, 0, ctx));
    }
  }

  // Prototype flows for this page
  if (flows.length > 0) {
    lines.push('');
    lines.push(_renderFlows(flows, ctx));
  }

  // Text inventory for this page
  const pageText = (doc.text || []).filter((t) => {
    // We don't store pageId on text nodes, so include all — they're scoped by page in perPage mode
    return true;
  });
  if (!ctx._pageTextFiltered && pageText.length > 0) {
    lines.push('');
    lines.push(_renderTextInventory(pageText, ctx));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Frame render
// ---------------------------------------------------------------------------

function _renderFrame(frame, depth, ctx) {
  if (depth > ctx.maxDepth) return '';
  const lines = [];
  const hLevel = Math.min(depth + 4, 6); // h4..h6
  const prefix = '#'.repeat(hLevel);
  const idTag = ctx.includeNodeIds ? ` \`[${frame.id}]\`` : '';
  const typeTag = frame.type !== 'FRAME' ? ` *(${frame.type})*` : '';

  lines.push(`${prefix} ${_applyMapping(frame.name)}${typeTag}${idTag}`);
  lines.push('');

  // Size + layout
  const { width, height } = frame.size || {};
  if (width || height) lines.push(`**Size:** ${width} × ${height} px`);
  if (frame.layoutMode && frame.layoutMode !== 'NONE') {
    lines.push(`**Auto Layout:** ${frame.layoutMode} | gap: ${frame.itemSpacing}px | padding: ${frame.paddingTop}/${frame.paddingRight}/${frame.paddingBottom}/${frame.paddingLeft}`);
  }
  if (frame.background) {
    const bg = frame.background;
    lines.push(`**Background:** ${bg.color || bg.type}${bg.opacity < 1 ? ` (opacity: ${bg.opacity})` : ''}`);
  }
  if (frame.cornerRadius) {
    const cr = frame.cornerRadius;
    const allSame = cr.topLeft === cr.topRight && cr.topRight === cr.bottomRight && cr.bottomRight === cr.bottomLeft;
    lines.push(`**Corner Radius:** ${allSame ? cr.topLeft + 'px' : `TL:${cr.topLeft} TR:${cr.topRight} BR:${cr.bottomRight} BL:${cr.bottomLeft}`}`);
  }
  if (frame.opacity < 1) lines.push(`**Opacity:** ${(frame.opacity * 100).toFixed(0)}%`);
  if (!frame.visible) lines.push(`> ⚠️ This frame is **hidden**`);
  if (frame.locked)   lines.push(`> 🔒 This frame is **locked**`);
  if (frame.clipsContent) lines.push(`**Clips Content:** yes`);
  lines.push('');

  // Child frames
  if (frame.childFrames?.length > 0) {
    for (const child of frame.childFrames) {
      lines.push(_renderFrame(child, depth + 1, ctx));
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

function _renderFlows(flows, ctx) {
  const lines = ['### Prototype Flows', ''];

  for (const flow of flows) {
    lines.push(`#### Flow: ${flow.flowName}`);
    lines.push('');
    if (ctx.includeNodeIds) lines.push(`**Start Node ID:** \`${flow.startNodeId}\``);
    lines.push(`**Start Screen:** ${flow.startNodeName || flow.startNodeId}`);
    if (flow.prototypeDevice) {
      const d = flow.prototypeDevice;
      const size = d.size ? ` (${d.size.width}×${d.size.height})` : '';
      lines.push(`**Device:** ${d.type}${size}`);
    }
    lines.push('');

    // Flow graph
    const { nodes, edges } = flow.graph || {};
    if (nodes?.length) {
      lines.push(`**Screens in flow (${nodes.length}):**`);
      lines.push('');
      for (const n of nodes) {
        const idNote = ctx.includeNodeIds ? ` \`${n.id}\`` : '';
        lines.push(`- ${n.name}${idNote} *(${n.type})*`);
      }
      lines.push('');
    }

    if (edges?.length) {
      lines.push(`**Transitions (${edges.length}):**`);
      lines.push('');
      lines.push('| From | To | Trigger | Action | Transition |');
      lines.push('|------|----|---------|--------|------------|');
      for (const e of edges) {
        const from = nodes?.find((n) => n.id === e.from)?.name || e.from;
        const to   = nodes?.find((n) => n.id === e.to)?.name || e.to;
        const trans = e.transition
          ? `${e.transition.type} ${(e.transition.duration * 1000).toFixed(0)}ms`
          : '—';
        lines.push(`| ${from} | ${to} | ${e.trigger} | ${e.action} | ${trans} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Interactions (global)
// ---------------------------------------------------------------------------

function _renderInteractionsGlobal(interactions) {
  const lines = ['## Interactions', ''];
  lines.push(`> Total interactions: **${interactions.length}**`);
  lines.push('');
  lines.push('| Source Node | Type | Trigger | Action | Destination |');
  lines.push('|-------------|------|---------|--------|-------------|');

  for (const ix of interactions) {
    const trigger = ix.trigger?.type || '—';
    const action  = ix.action?.type  || '—';
    const dest    = ix.action?.destinationId || ix.action?.url || '—';
    lines.push(`| ${truncate(ix.sourceNodeName, 40)} | ${ix.sourceNodeType} | ${trigger} | ${action} | ${dest} |`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function _renderComponents(components, ctx) {
  const lines = ['## Components', ''];
  const { definitions = [], instances = [] } = components;

  lines.push(`> **${definitions.length}** component definitions · **${instances.length}** instances`);
  lines.push('');

  // Group definitions by set
  const sets = definitions.filter((d) => d.type === 'COMPONENT_SET');
  const standalones = definitions.filter((d) => d.type === 'COMPONENT' && !d.containingSetId);
  const variants = definitions.filter((d) => d.type === 'COMPONENT' && d.containingSetId);

  if (sets.length) {
    lines.push('### Component Sets (Variants)');
    lines.push('');
    for (const set of sets) {
      const setVariants = variants.filter((v) => v.containingSetId === set.id);
      lines.push(`#### ${_applyMapping(set.name)}`);
      if (set.description) lines.push(`*${set.description}*`);
      lines.push('');
      if (ctx.includeNodeIds) lines.push(`**ID:** \`${set.id}\``);
      if (setVariants.length) {
        lines.push(`**Variants (${setVariants.length}):** ${setVariants.map((v) => _applyMapping(v.name)).join(', ')}`);
      }
      lines.push('');
    }
  }

  if (standalones.length) {
    lines.push('### Standalone Components');
    lines.push('');
    for (const comp of standalones) {
      const idTag = ctx.includeNodeIds ? ` \`[${comp.id}]\`` : '';
      lines.push(`- **${_applyMapping(comp.name)}**${idTag}${comp.description ? ' — ' + comp.description : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Styles / Design tokens
// ---------------------------------------------------------------------------

function _renderStyles(styles) {
  const lines = ['## Design Styles', ''];

  const grouped = {};
  for (const s of styles) {
    const group = s.styleType || 'OTHER';
    (grouped[group] = grouped[group] || []).push(s);
  }

  for (const [type, items] of Object.entries(grouped)) {
    lines.push(`### ${type} Styles (${items.length})`);
    lines.push('');
    lines.push('| Name | Description |');
    lines.push('|------|-------------|');
    for (const s of items) {
      lines.push(`| ${s.name} | ${s.description || '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Text inventory
// ---------------------------------------------------------------------------

function _renderTextInventory(textNodes, ctx) {
  const lines = ['### Text Inventory', ''];
  lines.push('| Text (truncated) | Font | Size | Weight | Color |');
  lines.push('|------------------|------|-----:|-------:|-------|');
  for (const t of textNodes) {
    const text = truncate(t.characters, 60).replace(/\n/g, ' ');
    lines.push(`| ${text || '*(empty)*'} | ${t.fontFamily || '—'} | ${t.fontSize || '—'} | ${t.fontWeight || '—'} | ${t.color || '—'} |`);
  }
  return lines.join('\n');
}

module.exports = { render };
