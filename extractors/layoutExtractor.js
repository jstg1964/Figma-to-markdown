'use strict';

const { walkTree, colorToCSS, constraintLabel } = require('../utils/helpers');

/**
 * Extract layout information from all nodes in a Figma document.
 * Covers: auto-layout, constraints, grids, guides, absolute positioning.
 *
 * @param {object} document - Figma document root
 * @returns {object[]} Array of normalised layout descriptors (one per relevant node)
 */
function extractLayout(document) {
  if (!document) return [];

  const layouts = [];
  walkTree(document, (node) => {
    const layout = _extractNodeLayout(node);
    if (layout) layouts.push(layout);
  });
  return layouts;
}

function _extractNodeLayout(node) {
  const box = node.absoluteBoundingBox || node.absoluteRenderBounds;
  const hasLayout =
    node.layoutMode ||
    node.constraints ||
    node.layoutGrids?.length ||
    box;

  if (!hasLayout) return null;

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    // Absolute position & size
    bounds: box
      ? {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      : null,
    rotation: node.rotation ? Number(node.rotation.toFixed(2)) : 0,
    // Auto-layout (Flex)
    autoLayout: _extractAutoLayout(node),
    // Constraints (how the node scales relative to parent)
    constraints: _extractConstraints(node),
    // Layout grids (rows, columns, grids)
    layoutGrids: _extractLayoutGrids(node),
    // Align & distribution within auto-layout parent
    layoutAlign: node.layoutAlign || null,        // STRETCH | INHERIT | MIN | MAX | CENTER
    layoutGrow: node.layoutGrow ?? null,           // flex-grow equivalent
    layoutPositioning: node.layoutPositioning || null, // ABSOLUTE | AUTO
    // Min/max sizing
    minWidth: node.minWidth ?? null,
    maxWidth: node.maxWidth ?? null,
    minHeight: node.minHeight ?? null,
    maxHeight: node.maxHeight ?? null,
  };
}

function _extractAutoLayout(node) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null;

  return {
    direction: node.layoutMode, // HORIZONTAL | VERTICAL
    primaryAxisSizing: node.primaryAxisSizingMode || 'FIXED',    // FIXED | AUTO
    counterAxisSizing: node.counterAxisSizingMode || 'FIXED',
    primaryAxisAlign: node.primaryAxisAlignItems || 'MIN',        // MIN | MAX | CENTER | SPACE_BETWEEN
    counterAxisAlign: node.counterAxisAlignItems || 'MIN',        // MIN | MAX | CENTER | BASELINE
    gap: node.itemSpacing ?? 0,
    padding: {
      top: node.paddingTop ?? 0,
      right: node.paddingRight ?? 0,
      bottom: node.paddingBottom ?? 0,
      left: node.paddingLeft ?? 0,
    },
    wrap: node.layoutWrap === 'WRAP',
    wrapGap: node.counterAxisSpacing ?? 0,
    strokesIncludedInLayout: node.strokesIncludedInLayout ?? false,
  };
}

function _extractConstraints(node) {
  if (!node.constraints) return null;
  return {
    horizontal: node.constraints.horizontal || 'LEFT',
    vertical: node.constraints.vertical || 'TOP',
    label: constraintLabel(node.constraints),
  };
}

function _extractLayoutGrids(node) {
  if (!Array.isArray(node.layoutGrids) || node.layoutGrids.length === 0) return [];

  return node.layoutGrids.map((grid) => ({
    pattern: grid.pattern,       // COLUMNS | ROWS | GRID
    sectionSize: grid.sectionSize ?? null,
    count: grid.count ?? null,
    gutterSize: grid.gutterSize ?? null,
    offset: grid.offset ?? null,
    alignment: grid.alignment || 'CENTER',
    color: grid.color ? colorToCSS(grid.color) : null,
    visible: grid.visible !== false,
  }));
}

module.exports = { extractLayout };
