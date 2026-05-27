'use strict';

/**
 * Recursively walk a Figma node tree, calling visitor for each node.
 * @param {object} node  - Figma node
 * @param {Function} visitor - (node, depth, parent) => void | false
 *   Return false to skip children of this node.
 * @param {number} depth - Current depth (starts at 0)
 * @param {object|null} parent - Parent node
 * @param {number} maxDepth - Maximum depth to traverse
 */
function walkTree(node, visitor, depth = 0, parent = null, maxDepth = 50) {
  if (!node || depth > maxDepth) return;
  const result = visitor(node, depth, parent);
  if (result === false) return; // skip children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkTree(child, visitor, depth + 1, node, maxDepth);
    }
  }
}

/**
 * Find the first node matching predicate in a tree (BFS).
 */
function findNode(root, predicate) {
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (predicate(node)) return node;
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return null;
}

/**
 * Collect all nodes matching predicate in a tree (DFS).
 */
function collectNodes(root, predicate, maxDepth = 50) {
  const results = [];
  walkTree(root, (node, depth) => {
    if (predicate(node)) results.push(node);
  }, 0, null, maxDepth);
  return results;
}

/**
 * Convert a Figma RGBA object {r,g,b,a} to a CSS hex/rgba string.
 */
function colorToCSS(color) {
  if (!color) return 'transparent';
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  const a = color.a ?? 1;
  if (a === 1) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Convert a Figma constraint value to a human-readable string.
 */
function constraintLabel(constraint) {
  if (!constraint) return 'NONE';
  const { type, value } = constraint;
  return value !== undefined ? `${type}(${value})` : type;
}

/**
 * Slugify a string for use in anchors.
 */
function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate a string to maxLen, appending ellipsis if needed.
 */
function truncate(str, maxLen = 80) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Deep-clone a plain object (no functions/circular refs).
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safely get a nested value from an object by dot-path.
 * e.g. getPath(obj, 'a.b.c') === obj?.a?.b?.c
 */
function getPath(obj, path, defaultValue = undefined) {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return defaultValue;
    cur = cur[part];
  }
  return cur ?? defaultValue;
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

module.exports = {
  walkTree,
  findNode,
  collectNodes,
  colorToCSS,
  constraintLabel,
  slugify,
  truncate,
  deepClone,
  getPath,
  formatBytes,
};
