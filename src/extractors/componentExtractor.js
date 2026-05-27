'use strict';

const { walkTree, colorToCSS } = require('../utils/helpers');
const { config } = require('../config');

/**
 * Apply component name mapping if enabled
 */
function _applyMapping(name) {
  if (!config.componentMapping.enabled) return name;
  return config.componentMapping.mapping[name] || name;
}

/**
 * Extract all component and component-set instances from a Figma document.
 * Also collects the component metadata map if provided.
 *
 * @param {object} document   - Figma document root
 * @param {object} components - Figma file `components` metadata map (optional)
 * @param {object} componentSets - Figma file `componentSets` metadata map (optional)
 * @returns {{ definitions: object[], instances: object[] }}
 */
function extractComponents(document, components = {}, componentSets = {}) {
  const definitions = _extractDefinitions(components, componentSets);
  const instances = [];

  if (!document) return { definitions, instances };

  walkTree(document, (node) => {
    if (node.type === 'INSTANCE') {
      instances.push(_extractInstance(node, components));
    }
  });

  return { definitions, instances };
}

/**
 * Build a normalised list of component definitions from the file-level metadata.
 */
function _extractDefinitions(components, componentSets) {
  const defs = [];

  // Component sets (variants container)
  for (const [key, meta] of Object.entries(componentSets)) {
    defs.push({
      id: key,
      key: meta.key,
      name: _applyMapping(meta.name),
      description: meta.description || '',
      type: 'COMPONENT_SET',
      documentationLinks: meta.documentationLinks || [],
    });
  }

  // Individual components / variants
  for (const [key, meta] of Object.entries(components)) {
    defs.push({
      id: key,
      key: meta.key,
      name: _applyMapping(meta.name),
      description: meta.description || '',
      type: 'COMPONENT',
      containingSetId: meta.componentSetId || null,
      documentationLinks: meta.documentationLinks || [],
    });
  }

  return defs;
}

/**
 * Extract a INSTANCE node into a normalised descriptor.
 */
function _extractInstance(node, componentsMeta = {}) {
  const componentId = node.componentId || '';
  const componentMeta = componentsMeta[componentId] || {};
  const originalComponentName = componentMeta.name || node.name;

  return {
    id: node.id,
    name: node.name,
    componentId,
    componentName: _applyMapping(originalComponentName),
    componentKey: componentMeta.key || null,
    description: componentMeta.description || '',
    visible: node.visible !== false,
    opacity: node.opacity ?? 1,
    absoluteBounds: node.absoluteBoundingBox || null,
    // Property overrides applied to this instance
    overrides: _extractOverrides(node),
    // Component properties (variants, text overrides, etc.)
    componentProperties: node.componentProperties || {},
  };
}

/**
 * Collect node overrides in an INSTANCE node.
 * Overrides represent properties that differ from the component definition.
 */
function _extractOverrides(node) {
  const overrides = [];
  if (!Array.isArray(node.overrides)) return overrides;

  for (const override of node.overrides) {
    overrides.push({
      id: override.id,
      overriddenFields: override.overriddenFields || [],
    });
  }
  return overrides;
}

module.exports = { extractComponents };
