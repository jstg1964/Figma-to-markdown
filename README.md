# figma-to-markdown

A production-ready Node.js backend service that reads a Figma design and prototype via the Figma REST API, extracts all meaningful design data, normalises it into structured JSON, and renders it as clean Markdown.

---

## Features

| Capability | Details |
|---|---|
| **Figma API client** | Personal token & OAuth support, TTL-cached responses, typed error handling |
| **Frame extraction** | All frames, groups, sections — with size, background, auto-layout, corner radius |
| **Component extraction** | Component sets, variants, standalone components, instance overrides |
| **Text extraction** | Font family/weight/size, colour, line-height, letter-spacing, mixed styles |
| **Layout extraction** | Auto-layout (flex), constraints, layout grids, min/max sizing |
| **Interaction extraction** | All prototype reactions — triggers, actions, transitions, easing |
| **Flow extraction** | Prototype flows with full reachability graph (nodes + edges) |
| **Normalizer** | Single orchestrator merges all extractors into one typed JSON document |
| **Markdown renderer** | Full-document or per-page render — TOC, stats table, frames, flows, interactions, components, design styles |
| **REST endpoints** | JSON, Markdown, nodes, images, components, styles, versions, flows, interactions |
| **Caching** | In-memory LRU cache with configurable TTL and max-items |
| **Logging** | Winston — pretty (dev) or JSON (prod), request timing, error context |
| **Error handling** | Centralised handler — Figma errors, validation, timeouts, 404 |
| **Graceful shutdown** | SIGTERM / SIGINT with 10-second force-exit fallback |

---

## Project Structure

```
figma-to-markdown/
├── src/
│   ├── api/
│   │   ├── figmaClient.js          # Figma REST API client (no external HTTP lib)
│   │   └── routes/
│   │       ├── index.js            # Route aggregator
│   │       ├── figma.routes.js     # All /api/figma/* endpoints
│   │       └── health.routes.js    # /health, /health/ready, /health/cache
│   ├── extractors/
│   │   ├── frameExtractor.js       # FRAME / GROUP / SECTION / COMPONENT nodes
│   │   ├── componentExtractor.js   # Component definitions & instances
│   │   ├── textExtractor.js        # TEXT nodes + typography
│   │   ├── layoutExtractor.js      # Auto-layout, constraints, grids
│   │   ├── interactionExtractor.js # Prototype reactions
│   │   └── flowExtractor.js        # Prototype flows + reachability graph
│   ├── normalizers/
│   │   └── normalizer.js           # Orchestrates all extractors → typed JSON
│   ├── renderers/
│   │   └── markdownRenderer.js     # Typed JSON → Markdown string / page map
│   ├── middleware/
│   │   ├── errorHandler.js         # Global Express error handler + 404
│   │   ├── requestLogger.js        # Request/response timing logger
│   │   └── validate.js             # Input validation middleware factories
│   ├── utils/
│   │   ├── logger.js               # Winston logger singleton
│   │   ├── cache.js                # LRU in-memory cache with TTL
│   │   └── helpers.js              # walkTree, colorToCSS, slugify, etc.
│   ├── config/
│   │   └── index.js                # Config loader with validation
│   └── app.js                      # Express app factory
├── tests/
│   ├── fixtures/
│   │   └── sampleFigmaResponse.json  # Realistic fixture for all tests
│   ├── extractors.test.js
│   ├── normalizer.test.js
│   └── markdownRenderer.test.js
├── server.js                        # Entry point — boots server, graceful shutdown
├── .env.example                     # All supported environment variables
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- A Figma Personal Access Token — create one at **Figma → Settings → Account → Personal access tokens**

### 2. Install

```bash
git clone <repo-url>
cd figma-to-markdown
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env — at minimum, set FIGMA_ACCESS_TOKEN
```

### 4. Run

```bash
# Development (auto-restarts on file changes, Node ≥ 18.11)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:3000` by default.

---

## API Reference

All endpoints accept the Figma **file key** — the alphanumeric ID from a Figma file URL:
`https://www.figma.com/file/{FILE_KEY}/...`

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe (checks token config) |
| `GET` | `/health/cache` | Cache statistics |
| `DELETE` | `/health/cache` | Flush the in-memory cache |

### Figma

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/figma/:fileKey/json` | Full normalised JSON |
| `GET` | `/api/figma/:fileKey/markdown` | Full Markdown document |
| `GET` | `/api/figma/:fileKey/nodes` | Specific nodes by ID |
| `GET` | `/api/figma/:fileKey/images` | Rendered image URLs |
| `GET` | `/api/figma/:fileKey/components` | Component metadata |
| `GET` | `/api/figma/:fileKey/styles` | Design style metadata |
| `GET` | `/api/figma/:fileKey/versions` | File version history |
| `GET` | `/api/figma/:fileKey/flows` | Prototype flows + graphs |
| `GET` | `/api/figma/:fileKey/interactions` | All prototype interactions |
| `GET` | `/api/figma/:fileKey/validate` | Validate extraction against raw Figma data |

### Query Parameters

#### `/json` and `/markdown`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `version` | integer | — | Fetch a specific file version |
| `includeLayout` | boolean | `true` | Include layout extraction |
| `includeInteractions` | boolean | `true` | Include interaction extraction |
| `includeText` | boolean | `true` | Include text extraction |
| `includeComponents` | boolean | `true` | Include component extraction |
| `includeFlows` | boolean | `true` | Include prototype flow extraction |

#### `/markdown` only

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `perPage` | boolean | `false` | Return `{ pages: { [pageName]: markdownString } }` instead of a single string |
| `download` | boolean | `false` | Set `Content-Disposition: attachment` for file download |

#### `/nodes`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeIds` | string | ✅ | Comma-separated Figma node IDs |

#### `/images`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `nodeIds` | string | ✅ | Comma-separated node IDs |
| `format` | string | `png` | `png` \| `jpg` \| `svg` \| `pdf` |
| `scale` | number | `1` | Scale factor (0.01–4) |

---

## Example Requests

```bash
# Get full normalised JSON
curl http://localhost:3000/api/figma/abc123XYZ/json

# Get Markdown (download as file)
curl "http://localhost:3000/api/figma/abc123XYZ/markdown?download=true" -o design.md

# Per-page Markdown (returns JSON map)
curl "http://localhost:3000/api/figma/abc123XYZ/markdown?perPage=true"

# Only flows and interactions (skip text + layout for speed)
curl "http://localhost:3000/api/figma/abc123XYZ/json?includeText=false&includeLayout=false"

# Render specific nodes as PNG images at 2×
curl "http://localhost:3000/api/figma/abc123XYZ/images?nodeIds=10:1,10:2&format=png&scale=2"

# Flush the cache
curl -X DELETE http://localhost:3000/health/cache
```

---

## Environment Variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIGMA_ACCESS_TOKEN` | ✅ | — | Figma personal or OAuth token |
| `PORT` | — | `3000` | HTTP listen port |
| `NODE_ENV` | — | `development` | `development` \| `production` \| `test` |
| `FIGMA_TOKEN_TYPE` | — | `personal` | `personal` \| `oauth` |
| `FIGMA_TIMEOUT_MS` | — | `30000` | Figma API request timeout |
| `CACHE_ENABLED` | — | `true` | Enable/disable response caching |
| `CACHE_TTL_SECONDS` | — | `300` | Cache TTL in seconds |
| `LOG_LEVEL` | — | `debug` | `error` \| `warn` \| `info` \| `debug` |
| `LOG_FORMAT` | — | `pretty` | `pretty` (dev) \| `json` (prod) |
| `MD_INCLUDE_NODE_IDS` | — | `true` | Annotate Markdown headings with node IDs |
| `COMPONENT_MAPPING_ENABLED` | — | `false` | Enable component name mapping |
| `COMPONENT_MAPPING_FILE` | — | `ConversionMapForSynapse.json` | Path to component mapping JSON file |

---

## Component Name Mapping

This feature allows you to map Figma component names to custom component names (e.g., for a design system like Synapse). When enabled, component names in both JSON and Markdown outputs will be replaced according to the mapping.

### Usage

1. Create a mapping JSON file (default: `ConversionMapForSynapse.json` in the project root)
2. Add your component name mappings in the format: `{"OriginalName": "MappedName"}`
3. Set `COMPONENT_MAPPING_ENABLED=true` in your `.env` file
4. Optionally set a custom file path with `COMPONENT_MAPPING_FILE`

### Example Mapping File

```json
{
  "_comment": "Component name mapping for Synapse design system",
  "_description": "Map Figma component names to Synapse component names. If a component name is not in this list, the original name will be used.",
  "Button": "SynapseButton",
  "Checkbox": "SynapseCheckbox",
  "TextInput": "SynapseTextInput"
}
```

### Behavior

- Component names are mapped during extraction, affecting both JSON and Markdown outputs
- If a component name is not in the mapping file, the original name is preserved
- Keys starting with `_` in the mapping file are treated as comments and ignored
- The feature is opt-in via environment variable to avoid breaking existing behavior

---

## Testing

Tests use Node's built-in `assert` — no test framework required.

```bash
# Run all tests
npm test

# Run individual suites
npm run test:extractors
npm run test:normalizer
npm run test:renderer
```

All tests run against the realistic fixture in `tests/fixtures/sampleFigmaResponse.json` — no live Figma API calls needed.

---

## Architecture Notes

### Data Flow

```
Figma REST API
      │
      ▼
FigmaClient          ← handles auth, HTTP, caching, error mapping
      │
      ▼
Extractors           ← frameExtractor, componentExtractor, textExtractor,
      │                 layoutExtractor, interactionExtractor, flowExtractor
      ▼
Normalizer           ← orchestrates extractors → single typed JSON document
      │
      ├──────────────→  /json endpoint  →  { ok, data: NormalisedDocument }
      │
      └──────────────→  MarkdownRenderer  →  /markdown endpoint  →  .md string
```

### Extending

- **Add an extractor**: create `src/extractors/myExtractor.js`, export a function, import and call it in `normalizer.js`.
- **Change Markdown output**: edit `src/renderers/markdownRenderer.js` — each section is an isolated `_render*` function.
- **Add a Redis cache**: swap the `Cache` class in `src/utils/cache.js` for a Redis client; the interface (`get`, `set`, `delete`, `clear`) stays the same.
- **Add OAuth**: set `FIGMA_TOKEN_TYPE=oauth` and pass a Bearer token as `FIGMA_ACCESS_TOKEN`.

---

## License

MIT
