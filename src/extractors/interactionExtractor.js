'use strict';

function extractInteractions(document) {
  if (!document) return [];
  const interactions = [];
  _walk(document, interactions);
  return interactions;
}

function _walk(root, results) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    // If the node has transitionNodeID, use ONLY the legacy fields.
    // The node.interactions[] array will also be present but its action
    // comes through as NONE — the legacy fields have the complete data.
    if (node.transitionNodeID) {
      results.push(_fromLegacy(node));
    }
    // Otherwise try modern reactions[] or interactions[] arrays
    else {
      if (Array.isArray(node.reactions) && node.reactions.length > 0) {
        for (const r of node.reactions) {
          results.push(_fromReaction(node, r));
        }
      }
      if (Array.isArray(node.interactions) && node.interactions.length > 0) {
        for (const r of node.interactions) {
          if (r.action?.type !== 'NONE') {
            results.push(_fromReaction(node, r));
          }
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }
}

function _fromReaction(node, reaction) {
  return {
    sourceNodeId:   node.id,
    sourceNodeName: node.name,
    sourceNodeType: node.type,
    trigger: _trigger(reaction.trigger),
    action:  _action(reaction.action),
  };
}

function _fromLegacy(node) {
  return {
    sourceNodeId:   node.id,
    sourceNodeName: node.name,
    sourceNodeType: node.type,
    trigger: { type: 'ON_CLICK' },
    action: {
      type:          'NAVIGATE',
      destinationId: node.transitionNodeID,
      transition: {
        type:      node.transitionType     || 'DISSOLVE',
        duration:  node.transitionDuration ?? 300,
        easing:    node.transitionEasing   || 'EASE_OUT',
        direction: null,
      },
    },
  };
}

function _trigger(trigger) {
  if (!trigger) return { type: 'UNKNOWN' };
  switch (trigger.type) {
    case 'ON_CLICK': case 'ON_PRESS': case 'ON_RELEASE':
    case 'ON_HOVER': case 'ON_DRAG':  case 'MOUSE_ENTER':
    case 'MOUSE_LEAVE': case 'MOUSE_UP': case 'MOUSE_DOWN':
      return { type: trigger.type };
    case 'AFTER_TIMEOUT':
      return { type: trigger.type, timeoutMs: Math.round((trigger.timeout || 0) * 1000) };
    default:
      return { type: trigger.type || 'UNKNOWN' };
  }
}

function _action(action) {
  if (!action) return { type: 'NONE' };
  const base = { type: action.type };
  switch (action.type) {
    case 'NODE': case 'NAVIGATE':
      return { ...base, destinationId: action.destinationId || null,
               navigation: action.navigation || 'NAVIGATE',
               transition: _transition(action.transition) };
    case 'OVERLAY': case 'SWAP':
      return { ...base, destinationId: action.destinationId || null,
               transition: _transition(action.transition) };
    case 'SCROLL_TO':
      return { ...base, destinationId: action.destinationId || null };
    case 'BACK': case 'CLOSE':
      return base;
    case 'URL':
      return { ...base, url: action.url || '' };
    default:
      return { ...base };
  }
}

function _transition(t) {
  if (!t) return null;
  return { type: t.type, duration: t.duration ?? 300,
           easing: t.easing?.type || t.easingType || 'LINEAR',
           direction: t.direction || null };
}

module.exports = { extractInteractions };
