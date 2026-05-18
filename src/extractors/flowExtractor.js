'use strict';

/**
 * Extract prototype flows from a Figma document.
 *
 * Strategy:
 *  1. Use explicit flowStartingPoints on each page canvas (the proper Figma way).
 *  2. If none are set, infer flows from the interaction graph — find all frames
 *     that are sources of interactions but never destinations (i.e. likely roots).
 */

function extractFlows(fileData) {
  if (!fileData?.document) return [];

  const flows = [];

  for (const page of (fileData.document.children || [])) {
    if (page.type !== 'CANVAS') continue;

    // Build a flat map of all nodes on this page
    const nodeMap = {};
    _indexNodes(page, nodeMap);

    // Build interaction graph: sourceId -> [destinationId, ...]
    const graph = {};
    const allDestinations = new Set();
    _buildGraph(page, graph, allDestinations);

    const hasStartingPoints =
      Array.isArray(page.flowStartingPoints) && page.flowStartingPoints.length > 0;

    if (hasStartingPoints) {
      // ── Explicit flows ──────────────────────────────────────────────────
      for (const sp of page.flowStartingPoints) {
        const startNode = nodeMap[sp.nodeId];
        flows.push(_buildFlow(
          sp.name || startNode?.name || 'Unnamed Flow',
          sp.nodeId,
          startNode,
          graph,
          nodeMap,
          page.name,
          'explicit'
        ));
      }
    } else {
      // ── Inferred flows ──────────────────────────────────────────────────
      // Root nodes = nodes that have outgoing interactions but are never
      // the destination of another interaction
      const allSources = Object.keys(graph);

      if (allSources.length === 0) continue; // page has no interactions at all

      // Walk up to find the top-level frame ancestor of each source node
      const rootFrames = new Set();
      for (const sourceId of allSources) {
        const topFrame = _findTopLevelFrame(sourceId, nodeMap, page);
        if (topFrame) rootFrames.add(topFrame.id);
      }

      // Also add destination top-level frames
      for (const destId of allDestinations) {
        const topFrame = _findTopLevelFrame(destId, nodeMap, page);
        if (topFrame) rootFrames.add(topFrame.id);
      }

      // Build a graph at the frame level
      const frameGraph = {};
      for (const [srcId, dests] of Object.entries(graph)) {
        const srcFrame  = _findTopLevelFrame(srcId, nodeMap, page);
        if (!srcFrame) continue;
        for (const destId of dests) {
          const destFrame = _findTopLevelFrame(destId, nodeMap, page);
          if (!destFrame || destFrame.id === srcFrame.id) continue;
          if (!frameGraph[srcFrame.id]) frameGraph[srcFrame.id] = new Set();
          frameGraph[srcFrame.id].add(destFrame.id);
        }
      }

      // Convert sets to arrays
      for (const k of Object.keys(frameGraph)) {
        frameGraph[k] = [...frameGraph[k]];
      }

      // Find frame-level roots (never a destination)
      const frameDests = new Set(Object.values(frameGraph).flat());
      const frameRoots = [...rootFrames].filter(id => !frameDests.has(id));
      const useRoots   = frameRoots.length > 0 ? frameRoots : [...rootFrames];

      for (const rootId of useRoots) {
        const rootNode = nodeMap[rootId];
        flows.push(_buildFlow(
          `Inferred Flow from "${rootNode?.name || rootId}"`,
          rootId,
          rootNode,
          frameGraph,
          nodeMap,
          page.name,
          'inferred'
        ));
      }
    }
  }

  return flows;
}

// ---------------------------------------------------------------------------
// Build a flow object given a starting node and the interaction graph
// ---------------------------------------------------------------------------

function _buildFlow(name, startId, startNode, graph, nodeMap, pageName, source) {
  // BFS to collect all reachable screens
  const visited = new Set();
  const queue   = [startId];
  const transitions = [];

  while (queue.length) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const destinations = graph[currentId] || [];
    for (const destId of destinations) {
      const destNode = nodeMap[destId];
      transitions.push({
        from:   { id: currentId, name: nodeMap[currentId]?.name || currentId },
        to:     { id: destId,    name: destNode?.name || destId },
      });
      if (!visited.has(destId)) queue.push(destId);
    }
  }

  const screens = [...visited].map(id => ({
    id,
    name: nodeMap[id]?.name || id,
  }));

  return {
    name,
    pageName,
    source,
    startNodeId:   startId,
    startNodeName: startNode?.name || startId,
    screenCount:   screens.length,
    screens,
    transitionCount: transitions.length,
    transitions,
  };
}

// ---------------------------------------------------------------------------
// Build interaction graph from all nodes: sourceId -> [destinationId]
// ---------------------------------------------------------------------------

function _buildGraph(root, graph, allDestinations) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    // Legacy transitionNodeID
    if (node.transitionNodeID) {
      if (!graph[node.id]) graph[node.id] = [];
      if (!graph[node.id].includes(node.transitionNodeID)) {
        graph[node.id].push(node.transitionNodeID);
        allDestinations.add(node.transitionNodeID);
      }
    }

    // Modern reactions[]
    for (const r of (node.reactions || [])) {
      const dest = r.action?.destinationId;
      if (dest) {
        if (!graph[node.id]) graph[node.id] = [];
        if (!graph[node.id].includes(dest)) {
          graph[node.id].push(dest);
          allDestinations.add(dest);
        }
      }
    }

    // Modern interactions[]
    for (const r of (node.interactions || [])) {
      const dest = r.action?.destinationId;
      if (dest && r.action?.type !== 'NONE') {
        if (!graph[node.id]) graph[node.id] = [];
        if (!graph[node.id].includes(dest)) {
          graph[node.id].push(dest);
          allDestinations.add(dest);
        }
      }
    }

    for (const child of (node.children || [])) stack.push(child);
  }
}

// ---------------------------------------------------------------------------
// Index all nodes by id
// ---------------------------------------------------------------------------

function _indexNodes(root, map) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    map[node.id] = node;
    for (const child of (node.children || [])) stack.push(child);
  }
}

// ---------------------------------------------------------------------------
// Find the direct child-of-canvas (top-level frame) ancestor of a node
// ---------------------------------------------------------------------------

function _findTopLevelFrame(nodeId, nodeMap, page) {
  // Top-level frames are direct children of the CANVAS page
  const topLevelIds = new Set((page.children || []).map(n => n.id));
  if (topLevelIds.has(nodeId)) return nodeMap[nodeId];

  // Otherwise check if the node itself is in the map and walk up isn't possible
  // (we don't store parent refs), so check if the node id is a top-level child
  // by scanning for it in the page's direct children
  for (const frame of (page.children || [])) {
    if (_containsNode(frame, nodeId)) return frame;
  }
  return null;
}

function _containsNode(root, targetId) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.id === targetId) return true;
    for (const child of (node.children || [])) stack.push(child);
  }
  return false;
}

module.exports = { extractFlows };
