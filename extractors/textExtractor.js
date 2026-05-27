'use strict';

const { collectNodes, colorToCSS, truncate } = require('../utils/helpers');

/**
 * Extract all TEXT nodes from a Figma document tree.
 *
 * @param {object} document - Figma document root
 * @returns {object[]} Array of normalised text descriptors
 */
function extractText(document) {
  if (!document) return [];

  const textNodes = collectNodes(document, (node) => node.type === 'TEXT');
  return textNodes.map(_normaliseTextNode);
}

function _normaliseTextNode(node) {
  const style = node.style || {};
  const fills = node.fills || [];
  const solidFill = fills.find((f) => f.type === 'SOLID' && f.visible !== false);

  return {
    id: node.id,
    name: node.name,
    characters: node.characters || '',
    truncated: truncate(node.characters || '', 120),
    // Typography
    fontFamily: style.fontFamily || null,
    fontStyle: style.fontPostScriptName || style.fontStyle || null,
    fontSize: style.fontSize || null,
    fontWeight: style.fontWeight || null,
    lineHeight: _normaliseLineHeight(style),
    letterSpacing: _normaliseLetterSpacing(style),
    textAlignHorizontal: style.textAlignHorizontal || 'LEFT',
    textAlignVertical: style.textAlignVertical || 'TOP',
    textDecoration: style.textDecoration || 'NONE',
    textCase: style.textCase || 'ORIGINAL',
    textAutoResize: style.textAutoResize || 'NONE',
    // Colour
    color: solidFill ? colorToCSS(solidFill.color) : null,
    // Bounds
    absoluteBounds: node.absoluteBoundingBox || null,
    // Paragraph
    paragraphIndent: style.paragraphIndent || 0,
    paragraphSpacing: style.paragraphSpacing || 0,
    // Mixed styles (char-level overrides)
    characterStyleOverrides: node.characterStyleOverrides || [],
    styleOverrideTable: node.styleOverrideTable || {},
    // Visibility
    visible: node.visible !== false,
    opacity: node.opacity ?? 1,
    // Hyperlinks
    hyperlink: node.hyperlink || null,
  };
}

function _normaliseLineHeight(style) {
  if (!style.lineHeightPx && style.lineHeightPercent === 100) {
    return { value: 'auto', unit: 'AUTO' };
  }
  return {
    value: style.lineHeightPx || style.lineHeightPercent || 'auto',
    unit: style.lineHeightUnit || (style.lineHeightPx ? 'PIXELS' : 'PERCENT'),
  };
}

function _normaliseLetterSpacing(style) {
  return {
    value: style.letterSpacing || 0,
    unit: style.letterSpacingUnit || 'PIXELS',
  };
}

module.exports = { extractText };
