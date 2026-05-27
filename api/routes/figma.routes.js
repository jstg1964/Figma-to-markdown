'use strict';

const { Router } = require('express');
const { FigmaClient } = require('../figmaClient');
const { normalize } = require('../../normalizers/normalizer');
const { render } = require('../../renderers/markdownRenderer');
const { validateFileKey, validateFigmaQueryParams } = require('../../middleware/validate');
const { extractInteractions } = require('../../extractors/interactionExtractor');
const { extractFlows } = require('../../extractors/flowExtractor');
const { cache } = require('../../utils/cache');
const { compileAISpec } = require("../../ai/compiler/compileAISpec");
const logger = require('../../utils/logger');

const router = Router();
const figma  = new FigmaClient();

function parseNormalizerOpts(query) {
  return {
    includeLayout:       query.includeLayout       !== false,
    includeInteractions: query.includeInteractions  !== false,
    includeText:         query.includeText          !== false,
    includeComponents:   query.includeComponents    !== false,
    includeFlows:        query.includeFlows         !== false,
  };
}

router.get('/:fileKey/json', validateFileKey, validateFigmaQueryParams, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const { version } = req.query;
    const [fileData, stylesData] = await Promise.all([
      figma.getFile(fileKey, version ? { version } : {}),
      figma.getStyles(fileKey).catch(() => ({})),
    ]);
    const normalised = normalize(fileData, stylesData, parseNormalizerOpts(req.query));
    res.json({ ok: true, fileKey, data: normalised });
  } catch (err) { next(err); }
});

router.get('/:fileKey/markdown', validateFileKey, validateFigmaQueryParams, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const { version, perPage, download } = req.query;
    const [fileData, stylesData] = await Promise.all([
      figma.getFile(fileKey, version ? { version } : {}),
      figma.getStyles(fileKey).catch(() => ({})),
    ]);
    const normalised = normalize(fileData, stylesData, parseNormalizerOpts(req.query));
    const rendered   = render(normalised, { perPage: Boolean(perPage) });
    const aiSafe = compileAISpec(fileData.document);
//    if (perPage) return res.json({ ok: true, fileKey, pages: rendered });
    if (perPage) return res.json({ ok: true, fileKey, pages: rendered, aiSafe });
    if (download) res.setHeader('Content-Disposition', `attachment; filename="${fileKey}-figma.md"`);
    res.type('text/markdown; charset=utf-8').send(rendered + '\n\n--- THE FOLLLOWING IS AI-SAFE CONTENT ---\n\n' + aiSafe);
  } catch (err) { next(err); }
});

router.get('/:fileKey/interactions', validateFileKey, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    logger.info(`[Interactions] Fetching fresh file data for ${fileKey}`);
    cache.delete(`file:${fileKey}:{}`);
    const fileData     = await figma.getFile(fileKey);
    const interactions = extractInteractions(fileData.document);
    const byTrigger = {};
    for (const ix of interactions) {
      const t = ix.trigger?.type || 'UNKNOWN';
      byTrigger[t] = (byTrigger[t] || 0) + 1;
    }
    res.json({ ok: true, fileKey, interactionCount: interactions.length, byTrigger, interactions });
  } catch (err) { next(err); }
});

router.get('/:fileKey/flows', validateFileKey, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    cache.delete(`file:${fileKey}:{}`);
    const fileData = await figma.getFile(fileKey);
    const flows    = extractFlows(fileData);
    res.json({ ok: true, fileKey, flowCount: flows.length, flows });
  } catch (err) { next(err); }
});

router.get('/:fileKey/debug', validateFileKey, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    cache.delete(`file:${fileKey}:{}`);
    const fileData = await figma.getFile(fileKey);
    const interactionFields = ['reactions','transitionNodeID','transitionDuration','transitionType','transitionEasing'];
    const hits = [];
    function walk(node, depth) {
      if (!node || depth > 30) return;
      const found = {};
      for (const f of interactionFields) {
        if (node[f] !== undefined) found[f] = node[f];
      }
      if (Object.keys(found).length) {
        hits.push({ id: node.id, name: node.name, type: node.type, depth, interactionFields: found, allFields: Object.keys(node) });
      }
      for (const child of (node.children || [])) walk(child, depth + 1);
    }
    walk(fileData.document, 0);
    const pages = (fileData.document?.children || [])
      .filter(n => n.type === 'CANVAS')
      .map(p => ({ id: p.id, name: p.name, flowStartingPoints: p.flowStartingPoints || [], prototypeDevice: p.prototypeDevice || null, topLevelNodeCount: (p.children || []).length }));
    res.json({ ok: true, fileKey, fileName: fileData.name, pages, nodesWithInteractionFields: hits.length, interactionNodes: hits });
  } catch (err) { next(err); }
});

router.get('/:fileKey/nodes', validateFileKey, validateFigmaQueryParams, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const nodeIds = req.parsedNodeIds;
    if (!nodeIds || nodeIds.length === 0) {
      return res.status(400).json({ error: { type: 'VALIDATION_ERROR', message: 'nodeIds required.' } });
    }
    const data = await figma.getFileNodes(fileKey, nodeIds);
    res.json({ ok: true, fileKey, nodeIds, data });
  } catch (err) { next(err); }
});

router.get('/:fileKey/images', validateFileKey, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const { nodeIds, format = 'png', scale = '1' } = req.query;
    if (!nodeIds) return res.status(400).json({ error: { type: 'VALIDATION_ERROR', message: 'nodeIds required.' } });
    const ids      = nodeIds.split(',').map(s => s.trim()).filter(Boolean);
    const scaleNum = Math.min(Math.max(parseFloat(scale) || 1, 0.01), 4);
    const data     = await figma.getImages(fileKey, ids, { format, scale: scaleNum });
    res.json({ ok: true, fileKey, format, scale: scaleNum, images: data.images || {} });
  } catch (err) { next(err); }
});

router.get('/:fileKey/components', validateFileKey, async (req, res, next) => {
  try {
    const data = await figma.getComponents(req.params.fileKey);
    res.json({ ok: true, fileKey: req.params.fileKey, data });
  } catch (err) { next(err); }
});

router.get('/:fileKey/styles', validateFileKey, async (req, res, next) => {
  try {
    const data = await figma.getStyles(req.params.fileKey);
    res.json({ ok: true, fileKey: req.params.fileKey, data });
  } catch (err) { next(err); }
});

router.get('/:fileKey/versions', validateFileKey, async (req, res, next) => {
  try {
    const data = await figma.getVersions(req.params.fileKey);
    res.json({ ok: true, fileKey: req.params.fileKey, data });
  } catch (err) { next(err); }
});

router.get('/:fileKey/validate', validateFileKey, async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    cache.delete(`file:${fileKey}:{}`);
    const fileData = await figma.getFile(fileKey);
    const normalised = normalize(fileData, {}, parseNormalizerOpts(req.query));

    // Count and collect elements in raw Figma data
    let rawFrameCount = 0;
    let rawTextCount = 0;
    let rawComponentCount = 0;
    const rawFrames = [];

    function collectNodes(node, depth = 0, parentId = null) {
      if (!node) return;
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'GROUP' || node.type === 'SECTION' || node.type === 'INSTANCE') {
        rawFrameCount++;
        rawFrames.push({
          id: node.id,
          name: node.name,
          type: node.type,
          depth,
          parentId,
          visible: node.visible !== false,
          locked: node.locked === true,
        });
      }
      if (node.type === 'TEXT') {
        rawTextCount++;
      }
      if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        rawComponentCount++;
      }
      if (node.children) {
        for (const child of node.children) {
          collectNodes(child, depth + 1, node.id);
        }
      }
    }

    if (fileData.document) {
      collectNodes(fileData.document);
    }

    // Collect extracted frame IDs for comparison
    const extractedFrameIds = new Set();
    function collectExtractedFrameIds(frames) {
      for (const frame of frames || []) {
        extractedFrameIds.add(frame.id);
        if (frame.childFrames) {
          collectExtractedFrameIds(frame.childFrames);
        }
      }
    }
    collectExtractedFrameIds(normalised.frames);

    // Find missing frames
    const missingFrames = rawFrames.filter(f => !extractedFrameIds.has(f.id));

    const validation = {
      fileKey,
      fileName: fileData.name,
      extracted: {
        frames: normalised.stats?.frameCount || 0,
        text: normalised.stats?.textCount || 0,
        components: normalised.stats?.componentDefinitionCount || 0,
        componentInstances: normalised.stats?.componentInstanceCount || 0,
        interactions: normalised.stats?.interactionCount || 0,
        flows: normalised.stats?.flowCount || 0,
      },
      raw: {
        frames: rawFrameCount,
        text: rawTextCount,
        components: rawComponentCount,
      },
      discrepancies: [],
      missingFrames: missingFrames.slice(0, 50), // Limit to first 50
      missingFramesCount: missingFrames.length,
      pages: normalised.pages?.map(p => ({
        name: p.name,
        id: p.id,
        childCount: p.childCount,
        flowStartingPoints: p.flowStartingPoints?.length || 0,
      })) || [],
    };

    // Check for discrepancies
    if (validation.extracted.frames !== validation.raw.frames) {
      validation.discrepancies.push({
        type: 'FRAME_COUNT_MISMATCH',
        extracted: validation.extracted.frames,
        raw: validation.raw.frames,
        missing: validation.missingFramesCount,
        message: `Frame count differs: extracted ${validation.extracted.frames}, raw ${validation.raw.frames}, missing ${validation.missingFramesCount}`,
      });
    }

    if (validation.extracted.text !== validation.raw.text) {
      validation.discrepancies.push({
        type: 'TEXT_COUNT_MISMATCH',
        extracted: validation.extracted.text,
        raw: validation.raw.text,
        message: `Text count differs: extracted ${validation.extracted.text}, raw ${validation.raw.text}`,
      });
    }

    validation.ok = validation.discrepancies.length === 0;

    res.json({ ok: true, validation });
  } catch (err) { next(err); }
});

module.exports = router;
