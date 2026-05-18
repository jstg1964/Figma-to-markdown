'use strict';

const { extractFrames } = require('../extractors/frameExtractor');
const { extractComponents } = require('../extractors/componentExtractor');
const { extractText } = require('../extractors/textExtractor');
const { extractLayout } = require('../extractors/layoutExtractor');
const { extractInteractions } = require('../extractors/interactionExtractor');
const { extractFlows } = require('../extractors/flowExtractor');
const logger = require('../utils/logger');

/**
 * Orchestrate all extractors and produce a single, structured JSON
 * representation of a Figma file.
 *
 * @param {object} figmaFile       - Full response from GET /v1/files/:key
 * @param {object} [stylesData]    - Response from GET /v1/files/:key/styles   (optional)
 * @param {object} [opts]
 * @param {boolean} [opts.includeLayout=true]
 * @param {boolean} [opts.includeInteractions=true]
 * @param {boolean} [opts.includeText=true]
 * @param {boolean} [opts.includeComponents=true]
 * @param {boolean} [opts.includeFlows=true]
 * @returns {object} Normalised Figma document
 */
function normalize(figmaFile, stylesData = {}, opts = {}) {
  const {
    includeLayout = true,
    includeInteractions = true,
    includeText = true,
    includeComponents = true,
    includeFlows = true,
  } = opts;

  const document = figmaFile.document;
  const components = figmaFile.components || {};
  const componentSets = figmaFile.componentSets || {};

  logger.debug('Normalizing Figma file: ' + figmaFile.name);

  const result = {
    meta: _extractMeta(figmaFile),
    pages: _extractPages(document),
    frames: extractFrames(document),
  };

  if (includeComponents) {
    logger.debug('Extracting components...');
    result.components = extractComponents(document, components, componentSets);
  }

  if (includeText) {
    logger.debug('Extracting text nodes...');
    result.text = extractText(document);
  }

  if (includeLayout) {
    logger.debug('Extracting layout...');
    result.layout = extractLayout(document);
  }

  if (includeInteractions) {
    logger.debug('Extracting interactions...');
    result.interactions = extractInteractions(document);
  }

  if (includeFlows) {
    logger.debug('Extracting flows...');
    result.flows = extractFlows(figmaFile);
  }

  // Design tokens (styles)
  result.styles = _extractStyles(figmaFile.styles || {}, stylesData);

  // Summary stats
  result.stats = _buildStats(result);

  logger.info(`Normalization complete: ${result.stats.frameCount} frames, ` +
    `${result.stats.textCount} text nodes, ` +
    `${result.stats.interactionCount} interactions, ` +
    `${result.stats.flowCount} flows`);

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _extractMeta(file) {
  return {
    fileKey: file.fileKey || null,
    name: file.name,
    lastModified: file.lastModified,
    thumbnailUrl: file.thumbnailUrl || null,
    version: file.version,
    role: file.role || null,
    editorType: file.editorType || 'figma',
    schemaVersion: file.schemaVersion || null,
  };
}

function _extractPages(document) {
  if (!document || !Array.isArray(document.children)) return [];
  return document.children
    .filter((n) => n.type === 'CANVAS')
    .map((page) => ({
      id: page.id,
      name: page.name,
      backgroundColor: page.backgroundColor || null,
      prototypeStartNodeId: page.prototypeStartNodeID || null,
      flowStartingPoints: (page.flowStartingPoints || []).map((fp) => ({
        nodeId: fp.nodeId,
        name: fp.name,
      })),
      childCount: (page.children || []).length,
    }));
}

function _extractStyles(stylesMap, stylesData) {
  if (!stylesMap || Object.keys(stylesMap).length === 0) return [];

  return Object.entries(stylesMap).map(([nodeId, style]) => ({
    nodeId,
    key: style.key,
    name: style.name,
    styleType: style.styleType,   // FILL | TEXT | EFFECT | GRID
    description: style.description || '',
  }));
}

function _buildStats(result) {
  return {
    pageCount: result.pages?.length ?? 0,
    frameCount: _countFrames(result.frames),
    componentDefinitionCount: result.components?.definitions?.length ?? 0,
    componentInstanceCount: result.components?.instances?.length ?? 0,
    textCount: result.text?.length ?? 0,
    layoutCount: result.layout?.length ?? 0,
    interactionCount: result.interactions?.length ?? 0,
    flowCount: result.flows?.length ?? 0,
    styleCount: result.styles?.length ?? 0,
  };
}

function _countFrames(frames, count = 0) {
  for (const f of (frames || [])) {
    count++;
    if (f.childFrames?.length) {
      count = _countFrames(f.childFrames, count);
    }
  }
  return count;
}

module.exports = { normalize };
