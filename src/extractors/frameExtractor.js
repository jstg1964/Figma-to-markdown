'use strict';

const { walkTree, colorToCSS } = require('../utils/helpers');

/**
 * Figma node types that represent frames / screens.
 */
const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION']);

/**
 * Extract all frame-level nodes from a Figma document.
 * Top-level frames on canvases are treated as "screens".
 *
 * @param {object} document - Figma document root node
 * @returns {object[]} Array of normalised frame descriptors
 */
function extractFrames(document) {
  const frames = [];

  if (!document || !Array.isArray(document.children)) return frames;

  // Figma document → pages (CANVAS) → frames
  for (const page of document.children) {
    if (page.type !== 'CANVAS') continue;

    for (const topNode of (page.children || [])) {
      if (!FRAME_TYPES.has(topNode.type)) continue;
      frames.push(_extractFrame(topNode, page, 0));
    }
  }

  return frames;
}

/**
 * Extract a single frame node and its nested frames.
 */
function _extractFrame(node, page, depth) {
  const frame = {
    id: node.id,
    name: node.name,
    type: node.type,
    pageId: page.id,
    pageName: page.name,
    depth,
    absoluteBounds: node.absoluteBoundingBox || node.absoluteRenderBounds || null,
    size: _extractSize(node),
    background: _extractBackground(node),
    clipsContent: node.clipsContent ?? false,
    layoutMode: node.layoutMode || 'NONE',        // AUTO_LAYOUT direction
    primaryAxisSizing: node.primaryAxisSizingMode || 'FIXED',
    counterAxisSizing: node.counterAxisSizingMode || 'FIXED',
    itemSpacing: node.itemSpacing ?? 0,
    paddingLeft: node.paddingLeft ?? 0,
    paddingRight: node.paddingRight ?? 0,
    paddingTop: node.paddingTop ?? 0,
    paddingBottom: node.paddingBottom ?? 0,
    cornerRadius: _extractCornerRadius(node),
    opacity: node.opacity ?? 1,
    visible: node.visible !== false,
    locked: node.locked === true,
    exportSettings: node.exportSettings || [],
    prototypeStartNodeId: node.prototypeStartNodeID || null,
    childFrames: [],
    childCount: (node.children || []).length,
  };

  // Recursively extract nested frames (e.g. sections with frames inside)
  for (const child of (node.children || [])) {
    if (FRAME_TYPES.has(child.type)) {
      frame.childFrames.push(_extractFrame(child, page, depth + 1));
    }
  }

  return frame;
}

function _extractSize(node) {
  const box = node.absoluteBoundingBox || node.absoluteRenderBounds;
  if (box) {
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }
  if (node.size) {
    return { width: Math.round(node.size.x || 0), height: Math.round(node.size.y || 0) };
  }
  return { width: 0, height: 0 };
}

function _extractBackground(node) {
  const fills = node.fills || node.background || [];
  const solidFill = fills.find((f) => f.type === 'SOLID' && f.visible !== false);
  if (solidFill) {
    return {
      type: 'SOLID',
      color: colorToCSS(solidFill.color),
      opacity: solidFill.opacity ?? 1,
    };
  }
  const gradientFill = fills.find((f) => f.type && f.type.startsWith('GRADIENT'));
  if (gradientFill) {
    return { type: gradientFill.type };
  }
  return null;
}

function _extractCornerRadius(node) {
  if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
  }
  if (node.cornerRadius != null) {
    const r = node.cornerRadius;
    return { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r };
  }
  return null;
}

module.exports = { extractFrames };
