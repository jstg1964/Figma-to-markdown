function compileAISpec(figmaData) {
  const frames = []
  const textNodes = []
  const components = []
  const interactions = []
  const styles = new Map()
  const states = new Set()
  const visibilityRules = new Set()

  // Extract comprehensive data
  extractData(figmaData, frames, textNodes, components, interactions, styles, states, visibilityRules)

  return `# AI-SAFE SPEC

---

## FRAMES & LAYOUT

${frames.length > 0 ? frames.map(f => 
  `### ${f.name} [${f.id}]
- **Type:** ${f.type}
- **Size:** ${f.width}×${f.height}px
- **Position:** x:${f.x}, y:${f.y}
- **Background:** ${f.background || 'transparent'}
- **Auto Layout:** ${f.autoLayout || 'none'}
- **Padding:** ${f.padding || 'none'}
- **Gap:** ${f.gap || 'none'}
- **Clips Content:** ${f.clipsContent ? 'yes' : 'no'}
- **Visible:** ${f.visible ? 'yes' : 'no'}
- **Locked:** ${f.locked ? 'yes' : 'no'}
${f.children ? `- **Children:** ${f.children.length}` : ''}`
).join('\n\n') : 'No frames found'}

---

## TEXT STYLING

${textNodes.length > 0 ? textNodes.map(t => 
  `### "${t.characters}" [${t.id}]
- **Font:** ${t.fontFamily}
- **Size:** ${t.fontSize}px
- **Weight:** ${t.fontWeight}
- **Line Height:** ${t.lineHeight}
- **Letter Spacing:** ${t.letterSpacing}
- **Color:** ${t.color}
- **Alignment:** ${t.textAlignHorizontal} / ${t.textAlignVertical}
- **Case:** ${t.textCase}
- **Decoration:** ${t.textDecoration}
- **Position:** x:${t.x}, y:${t.y}
- **Visible:** ${t.visible ? 'yes' : 'no'}`
).join('\n\n') : 'No text nodes found'}

---

## COMPONENTS & INSTANCES

${components.length > 0 ? components.map(c => 
  `### ${c.name} [${c.id}]
- **Type:** ${c.type}
- **Component:** ${c.componentId || 'none'}
- **Position:** x:${c.x}, y:${c.y}
- **Size:** ${c.width}×${c.height}px
- **Visible:** ${c.visible ? 'yes' : 'no'}`
).join('\n\n') : 'No components found'}

---

## INTERACTIONS

${interactions.length > 0 ? interactions.map(i => 
  `### ${i.sourceName} [${i.sourceId}]
- **Trigger:** ${i.trigger}
- **Action:** ${i.action}
- **Destination:** ${i.destinationName || 'none'} [${i.destinationId || 'none'}]
- **Animation:** ${i.animation || 'none'}`
).join('\n\n') : 'No interactions found'}

---

## DESIGN STYLES

${styles.size > 0 ? Array.from(styles.entries()).map(([name, value]) => 
  `- **${name}:** ${value}`
).join('\n') : 'No custom styles found'}

---

## STATES

${states.size > 0 ? Array.from(states).map((s, i) => `${i + 1}. ${s}`).join('\n') : 'No specific states detected'}

---

## VISIBILITY RULES

${visibilityRules.size > 0 ? Array.from(visibilityRules).map((v, i) => `${i + 1}. ${v}`).join('\n') : 'No visibility rules detected'}

---

## IMPLEMENTATION REQUIREMENTS

### Layout Requirements
- Replicate exact frame sizes and positions
- Implement auto layout with specified padding and gaps
- Handle clipping content as specified
- Respect z-index/ordering from Figma layers

### Typography Requirements
- Use exact fonts specified (Roboto, etc.)
- Match font sizes, weights, and line heights
- Apply correct letter spacing
- Use exact colors from design
- Implement text alignments (left, center, right)
- Handle text case transformations

### Component Requirements
- Implement all components as reusable elements
- Match component properties exactly
- Handle component instances correctly
- Preserve component hierarchy

### Interaction Requirements
- Implement all click/tap interactions
- Handle navigation flows correctly
- Implement animations if specified
- Preserve interaction triggers and actions

### State Management
- Implement loading states where indicated
- Handle conditional visibility
- Manage component states (selected, disabled, etc.)
- Preserve hidden elements for conditional rendering

---

## COMPLETION CONTRACT

You MUST:
- Implement ALL frames with exact dimensions and positioning
- Implement ALL text with exact styling (font, size, weight, alignment, color)
- Implement ALL components and their instances
- Implement ALL interactions with correct triggers and actions
- Apply ALL design styles (colors, fonts, spacing)
- Respect ALL visibility rules and conditional rendering
- Implement ALL states (loading, error, etc.)
- Do NOT skip any element or property

Before finishing:
- Verify all frames are rendered with correct dimensions
- Verify all text has correct styling and alignment
- Verify all components are implemented
- Verify all interactions work correctly
- Verify design styles match exactly
- List any missing elements or properties
- Confirm full coverage of the design
`
}

function extractData(node, frames, textNodes, components, interactions, styles, states, visibilityRules, depth = 0) {
  if (!node) return

  const name = (node.name || "").toLowerCase()

  // Extract frames
  if (['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION', 'INSTANCE'].includes(node.type)) {
    const bounds = node.absoluteBoundingBox || node.absoluteRenderBounds || { x: 0, y: 0, width: 0, height: 0 }
    frames.push({
      id: node.id,
      name: node.name,
      type: node.type,
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      background: extractBackground(node),
      autoLayout: node.layoutMode ? `${node.layoutMode} ${node.primaryAxisSizingMode || ''}` : 'none',
      padding: node.padding ? `t:${node.padding.top} r:${node.padding.right} b:${node.padding.bottom} l:${node.padding.left}` : 'none',
      gap: node.itemSpacing || 'none',
      clipsContent: node.clipsContent || false,
      visible: node.visible !== false,
      locked: node.locked || false,
      children: node.children || []
    })

    // Detect states
    if (name.includes('loading')) states.add('Loading state must be implemented')
    if (name.includes('error')) states.add('Error state must be implemented')
    if (name.includes('empty')) states.add('Empty state must be implemented')
    if (name.includes('success')) states.add('Success state must be implemented')
  }

  // Extract text nodes
  if (node.type === 'TEXT') {
    const style = node.style || {}
    const fills = node.fills || []
    const solidFill = fills.find(f => f.type === 'SOLID' && f.visible !== false)
    const bounds = node.absoluteBoundingBox || { x: 0, y: 0 }
    
    textNodes.push({
      id: node.id,
      characters: node.characters || '',
      fontFamily: style.fontFamily || 'sans-serif',
      fontSize: style.fontSize || 16,
      fontWeight: style.fontWeight || 400,
      lineHeight: style.lineHeightPx || style.lineHeightPercent || 'auto',
      letterSpacing: style.letterSpacing || 0,
      color: solidFill ? rgbToHex(solidFill.color) : '#000000',
      textAlignHorizontal: style.textAlignHorizontal || 'LEFT',
      textAlignVertical: style.textAlignVertical || 'TOP',
      textCase: style.textCase || 'ORIGINAL',
      textDecoration: style.textDecoration || 'NONE',
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      visible: node.visible !== false
    })

    // Extract font styles
    if (style.fontFamily) {
      styles.set(`font-${style.fontFamily}`, style.fontFamily)
    }
    if (solidFill) {
      styles.set(`color-${rgbToHex(solidFill.color)}`, rgbToHex(solidFill.color))
    }
  }

  // Extract components
  if (node.type === 'INSTANCE' || node.type === 'COMPONENT') {
    const bounds = node.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 }
    components.push({
      id: node.id,
      name: node.name,
      type: node.type,
      componentId: node.componentId || node.id,
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      visible: node.visible !== false
    })
  }

  // Extract interactions
  if (node.reactions && node.reactions.length > 0) {
    node.reactions.forEach(reaction => {
      interactions.push({
        sourceId: node.id,
        sourceName: node.name,
        trigger: reaction.trigger?.type || 'UNKNOWN',
        action: reaction.action?.type || 'UNKNOWN',
        destinationId: reaction.action?.destinationId,
        destinationName: reaction.action?.destinationId || 'none',
        animation: reaction.action?.transition?.duration ? `${reaction.action.transition.duration}ms` : 'none'
      })
    })
  }

  // Visibility rules
  if (node.visible === false) {
    visibilityRules.add(`Element "${node.name}" must be conditionally rendered based on state`)
  }

  // Recurse into children
  if (node.children) {
    node.children.forEach(child => extractData(child, frames, textNodes, components, interactions, styles, states, visibilityRules, depth + 1))
  }
}

function extractBackground(node) {
  if (!node.fills || node.fills.length === 0) return 'transparent'
  const solidFill = node.fills.find(f => f.type === 'SOLID' && f.visible !== false)
  if (solidFill) return rgbToHex(solidFill.color)
  return 'transparent'
}

function rgbToHex(color) {
  if (!color) return '#000000'
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const a = color.a !== undefined ? color.a : 1
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

module.exports = { compileAISpec }
