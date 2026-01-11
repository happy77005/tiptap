# Approach 6: Custom ProseMirror/Tiptap Extension Implementation

This document provides a complete implementation guide for creating a custom Tiptap extension that handles pagination at the document model level, similar to how Google Docs or Microsoft Word Online work.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Implementation Steps](#implementation-steps)
5. [Code Implementation](#code-implementation)
6. [Key Concepts](#key-concepts)
7. [Edge Cases](#edge-cases)

---

## Overview

### What is Approach 6?

Instead of using DOM manipulation or visual overlays, Approach 6:
- Creates a **custom ProseMirror plugin** that runs on every document transaction
- Uses **ProseMirror decorations** to draw page boundaries directly in the editor
- Optionally inserts **page break nodes** into the document structure
- Provides **WYSIWYG pagination** that is part of the editor's core functionality

### Why Use This Approach?

| Advantage | Description |
|-----------|-------------|
| **Integrated** | Pagination is part of the document model, not a visual hack |
| **Collaborative-friendly** | Works with real-time sync (Yjs, Liveblocks) |
| **Consistent** | Same pagination logic for editing and export |
| **No DOM manipulation** | Uses ProseMirror's decoration system |
| **Full control** | Can implement any breaking logic |

### Limitations

| Challenge | Mitigation |
|-----------|------------|
| Complex implementation | Detailed guide provided below |
| Requires ProseMirror knowledge | Step-by-step code included |
| Performance considerations | Built-in optimizations |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         TIPTAP EDITOR                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  PaginationExtension                       │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │              PaginationPlugin                         │  │  │
│  │  │  • Runs on every transaction                         │  │  │
│  │  │  • Calculates page break positions                   │  │  │
│  │  │  • Returns decorations for page boundaries           │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │              PageBreakNode (optional)                 │  │  │
│  │  │  • Manual page break marker                          │  │  │
│  │  │  • Forces page break at specific location            │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Page Container CSS                        │  │
│  │  • A4 page styling via decorations                        │  │
│  │  • Page numbers and indicators                            │  │
│  │  • Print-ready layout                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. PaginationPlugin (ProseMirror Plugin)

The heart of Approach 6. This plugin:
- Runs `apply()` on every state transaction
- Measures node heights using a cached measurement strategy
- Determines where page breaks should occur
- Returns decorations that visually represent page boundaries

### 2. Decoration Types

ProseMirror decorations let us add visual elements **without modifying the document**:

| Decoration Type | Use Case |
|----------------|----------|
| `Decoration.widget()` | Insert page gap/separator between nodes |
| `Decoration.node()` | Add CSS classes to nodes near page boundaries |
| `Decoration.inline()` | Not used for pagination |

### 3. Height Measurement Strategy

Since ProseMirror plugins can't directly access the DOM, we use:
- **NodeSpec attributes** to store estimated heights
- **EditorView props** to measure actual heights after render
- **Caching** to avoid repeated measurements

### 4. Page State Storage

Use the plugin's state to store:
- Current page count
- Page break positions
- Cached node heights

---

## Implementation Steps

### Step 1: Create the Pagination Extension

```
extensions/
├── pagination/
│   ├── index.ts           # Main extension export
│   ├── plugin.ts          # ProseMirror plugin logic
│   ├── decorations.ts     # Decoration builders
│   ├── measurement.ts     # Height measurement utilities
│   ├── constants.ts       # A4 dimensions, margins
│   └── types.ts           # TypeScript types
```

### Step 2: Register the Plugin

```javascript
import { Extension } from '@tiptap/core'
import { paginationPlugin } from './plugin'

export const Pagination = Extension.create({
  name: 'pagination',
  
  addProseMirrorPlugins() {
    return [paginationPlugin(this.options)]
  },
})
```

### Step 3: Implement Height Measurement

Two approaches:
1. **Estimated heights** - Calculate based on node type and content length
2. **Actual heights** - Measure DOM after render (more accurate, slower)

### Step 4: Build Decorations

For each page break position, create:
- A widget decoration that shows the page break visually
- Node decorations that apply page-related styling

### Step 5: Add CSS for Page Layout

Style the decorations to look like A4 page boundaries.

---

## Code Implementation

### constants.ts

```typescript
// A4 dimensions at 96 DPI
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123
export const PAGE_MARGIN_TOP = 64
export const PAGE_MARGIN_BOTTOM = 64
export const PAGE_MARGIN_LEFT = 64
export const PAGE_MARGIN_RIGHT = 64

export const CONTENT_HEIGHT = A4_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM // 995px
export const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT // 666px

export const PAGE_GAP = 40 // Visual gap between pages

// Default line heights for estimation
export const DEFAULT_LINE_HEIGHT = 28 // 16px * 1.75
export const HEADING1_HEIGHT = 56
export const HEADING2_HEIGHT = 44
export const HEADING3_HEIGHT = 36
```

### types.ts

```typescript
export interface PageBreakPosition {
  pos: number           // Document position where break occurs
  pageNumber: number    // Page number after this break
  remainingSpace: number // Space left on previous page
}

export interface PaginationState {
  pageCount: number
  pageBreaks: PageBreakPosition[]
  nodeHeights: Map<number, number> // pos -> height
  version: number // For cache invalidation
}

export interface PaginationOptions {
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  pageGap: number
}
```

### measurement.ts

```typescript
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorView } from '@tiptap/pm/view'
import { HEADING1_HEIGHT, HEADING2_HEIGHT, HEADING3_HEIGHT, DEFAULT_LINE_HEIGHT } from './constants'

/**
 * Estimate node height based on its type and content
 * This is used for initial calculation before DOM is available
 */
export function estimateNodeHeight(node: ProseMirrorNode): number {
  switch (node.type.name) {
    case 'heading':
      const level = node.attrs.level
      if (level === 1) return HEADING1_HEIGHT
      if (level === 2) return HEADING2_HEIGHT
      if (level === 3) return HEADING3_HEIGHT
      return HEADING2_HEIGHT
      
    case 'paragraph':
      // Estimate based on text length and line width
      const textLength = node.textContent.length
      const charsPerLine = 80 // Approximate for content width
      const lines = Math.max(1, Math.ceil(textLength / charsPerLine))
      return lines * DEFAULT_LINE_HEIGHT + 16 // + margin
      
    case 'bulletList':
    case 'orderedList':
      let listHeight = 0
      node.forEach((child) => {
        listHeight += estimateNodeHeight(child)
      })
      return listHeight + 16 // + margin
      
    case 'listItem':
      let itemHeight = 0
      node.forEach((child) => {
        itemHeight += estimateNodeHeight(child)
      })
      return itemHeight
      
    case 'blockquote':
      let quoteHeight = 0
      node.forEach((child) => {
        quoteHeight += estimateNodeHeight(child)
      })
      return quoteHeight + 32 // + padding
      
    case 'codeBlock':
      const codeLines = (node.textContent.match(/\n/g) || []).length + 1
      return codeLines * 24 + 32 // monospace + padding
      
    case 'horizontalRule':
      return 40
      
    case 'pageBreak':
      return -1 // Special marker for forced break
      
    case 'image':
      // Default image height, will be updated after load
      return node.attrs.height || 200
      
    default:
      return DEFAULT_LINE_HEIGHT
  }
}

/**
 * Measure actual DOM height for a node
 * Should be called after render in EditorView
 */
export function measureNodeHeight(view: EditorView, pos: number): number | null {
  try {
    const dom = view.nodeDOM(pos)
    if (dom instanceof HTMLElement) {
      return dom.offsetHeight
    }
  } catch (e) {
    // Node might not be in DOM yet
  }
  return null
}

/**
 * Get or measure height for a node, with caching
 */
export function getNodeHeight(
  node: ProseMirrorNode,
  pos: number,
  view: EditorView | null,
  cache: Map<number, number>
): number {
  // Check cache first
  if (cache.has(pos)) {
    return cache.get(pos)!
  }
  
  // Try to measure from DOM
  if (view) {
    const measured = measureNodeHeight(view, pos)
    if (measured !== null) {
      cache.set(pos, measured)
      return measured
    }
  }
  
  // Fall back to estimation
  const estimated = estimateNodeHeight(node)
  return estimated
}
```

### decorations.ts

```typescript
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { PageBreakPosition } from './types'
import { A4_WIDTH, PAGE_GAP, PAGE_MARGIN_TOP, PAGE_MARGIN_BOTTOM } from './constants'

/**
 * Create a page separator widget
 */
export function createPageSeparator(pageNumber: number, totalPages: number): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'page-separator'
  wrapper.contentEditable = 'false'
  wrapper.setAttribute('data-page-break', 'true')
  
  wrapper.innerHTML = `
    <div class="page-separator-line"></div>
    <div class="page-footer page-footer-top">
      <span class="page-info">A4 • 210mm × 297mm</span>
      <span class="page-number">Page ${pageNumber} of ${totalPages}</span>
    </div>
    <div class="page-gap"></div>
    <div class="page-header">
      <div class="page-top-accent"></div>
    </div>
  `
  
  return wrapper
}

/**
 * Build decorations for all page breaks
 */
export function buildPageDecorations(
  pageBreaks: PageBreakPosition[],
  totalPages: number
): DecorationSet {
  const decorations: Decoration[] = []
  
  pageBreaks.forEach((pageBreak, index) => {
    const pageNumber = pageBreak.pageNumber
    
    // Create widget decoration for page separator
    const widget = Decoration.widget(pageBreak.pos, () => {
      return createPageSeparator(pageNumber, totalPages)
    }, {
      side: -1, // Insert before the node at this position
      key: `page-break-${pageNumber}`,
    })
    
    decorations.push(widget)
  })
  
  return DecorationSet.create(
    // We need the document to create DecorationSet
    // This will be provided by the plugin
    null as any, // Placeholder, actual doc passed in plugin
    decorations
  )
}
```

### plugin.ts

```typescript
import { Plugin, PluginKey, EditorState, Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { PaginationState, PaginationOptions, PageBreakPosition } from './types'
import { getNodeHeight, estimateNodeHeight } from './measurement'
import { createPageSeparator } from './decorations'
import { CONTENT_HEIGHT, PAGE_GAP, PAGE_MARGIN_TOP, PAGE_MARGIN_BOTTOM } from './constants'

export const paginationPluginKey = new PluginKey<PaginationState>('pagination')

/**
 * Calculate page breaks based on node heights
 */
function calculatePageBreaks(
  doc: ProseMirrorNode,
  view: EditorView | null,
  heightCache: Map<number, number>
): { pageBreaks: PageBreakPosition[], pageCount: number } {
  const pageBreaks: PageBreakPosition[] = []
  let currentPageHeight = 0
  let currentPageNumber = 1
  
  // Walk through all top-level nodes
  doc.forEach((node, offset) => {
    const pos = offset
    
    // Check for manual page break node
    if (node.type.name === 'pageBreak') {
      const remainingSpace = CONTENT_HEIGHT - currentPageHeight
      pageBreaks.push({
        pos: pos + node.nodeSize,
        pageNumber: currentPageNumber + 1,
        remainingSpace,
      })
      currentPageNumber++
      currentPageHeight = 0
      return
    }
    
    // Get height for this node
    const nodeHeight = getNodeHeight(node, pos, view, heightCache)
    
    // Would this node fit on current page?
    if (currentPageHeight + nodeHeight > CONTENT_HEIGHT && currentPageHeight > 0) {
      // Need a page break before this node
      const remainingSpace = CONTENT_HEIGHT - currentPageHeight
      pageBreaks.push({
        pos,
        pageNumber: currentPageNumber + 1,
        remainingSpace,
      })
      currentPageNumber++
      currentPageHeight = nodeHeight
    } else {
      currentPageHeight += nodeHeight
    }
  })
  
  return {
    pageBreaks,
    pageCount: currentPageNumber,
  }
}

/**
 * Create decorations for page separators
 */
function createDecorations(
  doc: ProseMirrorNode,
  pageBreaks: PageBreakPosition[],
  pageCount: number
): DecorationSet {
  if (pageBreaks.length === 0) {
    return DecorationSet.empty
  }
  
  const decorations: Decoration[] = []
  
  pageBreaks.forEach((pageBreak) => {
    const widget = Decoration.widget(
      pageBreak.pos,
      (view) => {
        return createPageSeparator(pageBreak.pageNumber, pageCount)
      },
      {
        side: -1,
        key: `page-sep-${pageBreak.pageNumber}`,
      }
    )
    decorations.push(widget)
  })
  
  return DecorationSet.create(doc, decorations)
}

/**
 * Create the pagination plugin
 */
export function paginationPlugin(options: Partial<PaginationOptions> = {}): Plugin {
  let editorView: EditorView | null = null
  
  return new Plugin<PaginationState>({
    key: paginationPluginKey,
    
    state: {
      init(_, state): PaginationState {
        const heightCache = new Map<number, number>()
        const { pageBreaks, pageCount } = calculatePageBreaks(
          state.doc,
          null, // No view yet
          heightCache
        )
        
        return {
          pageCount,
          pageBreaks,
          nodeHeights: heightCache,
          version: 0,
        }
      },
      
      apply(tr: Transaction, value: PaginationState, oldState, newState): PaginationState {
        // If document hasn't changed, keep existing state
        if (!tr.docChanged) {
          return value
        }
        
        // Recalculate page breaks
        const heightCache = new Map(value.nodeHeights)
        const { pageBreaks, pageCount } = calculatePageBreaks(
          newState.doc,
          editorView,
          heightCache
        )
        
        return {
          pageCount,
          pageBreaks,
          nodeHeights: heightCache,
          version: value.version + 1,
        }
      },
    },
    
    props: {
      decorations(state): DecorationSet {
        const pluginState = paginationPluginKey.getState(state)
        if (!pluginState) {
          return DecorationSet.empty
        }
        
        return createDecorations(
          state.doc,
          pluginState.pageBreaks,
          pluginState.pageCount
        )
      },
    },
    
    view(view) {
      editorView = view
      
      // Re-measure after initial render
      setTimeout(() => {
        const tr = view.state.tr.setMeta('remeasure', true)
        view.dispatch(tr)
      }, 100)
      
      return {
        update(view, prevState) {
          editorView = view
        },
        destroy() {
          editorView = null
        },
      }
    },
  })
}

/**
 * Get current page count from editor state
 */
export function getPageCount(state: EditorState): number {
  const pluginState = paginationPluginKey.getState(state)
  return pluginState?.pageCount || 1
}
```

### index.ts (Main Extension)

```typescript
import { Extension } from '@tiptap/core'
import { Node, mergeAttributes } from '@tiptap/core'
import { paginationPlugin, getPageCount, paginationPluginKey } from './plugin'
import { PaginationOptions } from './types'
import {
  A4_WIDTH,
  A4_HEIGHT,
  PAGE_MARGIN_TOP,
  PAGE_MARGIN_BOTTOM,
  PAGE_MARGIN_LEFT,
  PAGE_MARGIN_RIGHT,
  PAGE_GAP,
} from './constants'

// PageBreak Node for manual page breaks
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-break': 'true',
      'class': 'page-break-marker',
      'contenteditable': 'false',
    })]
  },
  
  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => {
        return commands.insertContent({ type: this.name })
      },
    }
  },
})

// Pagination Extension
export const Pagination = Extension.create<PaginationOptions>({
  name: 'pagination',
  
  addOptions() {
    return {
      pageWidth: A4_WIDTH,
      pageHeight: A4_HEIGHT,
      marginTop: PAGE_MARGIN_TOP,
      marginBottom: PAGE_MARGIN_BOTTOM,
      marginLeft: PAGE_MARGIN_LEFT,
      marginRight: PAGE_MARGIN_RIGHT,
      pageGap: PAGE_GAP,
    }
  },
  
  addProseMirrorPlugins() {
    return [paginationPlugin(this.options)]
  },
  
  addStorage() {
    return {
      pageCount: 1,
    }
  },
  
  onUpdate() {
    const state = this.editor.state
    this.storage.pageCount = getPageCount(state)
  },
})

// Re-export utilities
export { getPageCount, paginationPluginKey }
export * from './constants'
export * from './types'
```

### CSS Styles (pagination.css)

```css
/* Page separator widget */
.page-separator {
  position: relative;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  user-select: none;
  pointer-events: none;
}

.page-separator-line {
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, #e2e8f0, transparent);
  margin-bottom: var(--page-margin-bottom, 64px);
}

.page-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--page-gap, 40px) + var(--page-margin-top, 64px) + 16px);
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 11px;
  color: #9ca3af;
}

.page-gap {
  width: calc(100% + var(--page-margin-left, 64px) + var(--page-margin-right, 64px));
  height: var(--page-gap, 40px);
  background: linear-gradient(to bottom,
    rgba(226, 232, 240, 0) 0%,
    rgb(226, 232, 240) 20%,
    rgb(226, 232, 240) 80%,
    rgba(226, 232, 240, 0) 100%
  );
  margin-left: calc(-1 * var(--page-margin-left, 64px));
  position: relative;
}

.page-gap::after {
  content: 'Page Break';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #e2e8f0;
  padding: 2px 12px;
  border-radius: 10px;
  font-size: 10px;
  color: #64748b;
  font-weight: 500;
}

.page-header {
  height: var(--page-margin-top, 64px);
}

.page-top-accent {
  width: calc(100% + var(--page-margin-left, 64px) + var(--page-margin-right, 64px));
  height: 3px;
  background: linear-gradient(to right, #6366f1, #a855f7, #ec4899);
  opacity: 0.3;
  margin-left: calc(-1 * var(--page-margin-left, 64px));
}

/* Manual page break marker */
.page-break-marker {
  display: block;
  height: 32px;
  margin: 16px 0;
  border: 2px dashed #6366f1;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
  position: relative;
}

.page-break-marker::after {
  content: '— Manual Page Break —';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  color: #6366f1;
  font-weight: 500;
  background: white;
  padding: 0 10px;
}

/* Print styles */
@media print {
  .page-separator {
    display: block !important;
    break-after: always;
    page-break-after: always;
    height: 0;
    overflow: hidden;
  }
  
  .page-separator-line,
  .page-footer,
  .page-gap,
  .page-header {
    display: none;
  }
  
  .page-break-marker {
    break-after: always;
    page-break-after: always;
    height: 0;
    border: none;
    margin: 0;
    visibility: hidden;
  }
}
```

---

## Key Concepts

### 1. Transaction-Based Updates

The plugin recalculates on every document change via `apply()`. This ensures pagination is always up-to-date without needing external triggers.

### 2. Decoration Widgets

Widgets are inserted into the view without modifying the document. This means:
- The document content remains clean
- Decorations automatically update when the document changes
- No risk of infinite loops from DOM manipulation

### 3. Height Caching

To avoid performance issues, heights are cached by document position. The cache is invalidated when the document changes.

### 4. Two-Phase Measurement

1. **Initial phase**: Use estimates based on node type
2. **After render**: Measure actual DOM heights and update

### 5. Page Count Access

The page count is stored in the plugin state and can be accessed:
```javascript
const pageCount = getPageCount(editor.state)
// Or via extension storage
const pageCount = editor.storage.pagination.pageCount
```

---

## Edge Cases

### Long Nodes That Exceed Page Height

If a single node (e.g., very long paragraph) exceeds page height:

```typescript
// In calculatePageBreaks:
if (nodeHeight > CONTENT_HEIGHT) {
  // Option 1: Allow overflow (simplest)
  // Just add the node and let it overflow
  currentPageHeight = nodeHeight % CONTENT_HEIGHT
  
  // Option 2: Split the node (complex)
  // Would require modifying the document
}
```

### Images Loading

Images may have unknown height initially:

```typescript
// Add an image load listener
function handleImageLoad(view: EditorView) {
  // Force recalculation after images load
  const tr = view.state.tr.setMeta('imagesLoaded', true)
  view.dispatch(tr)
}
```

### Font Loading

Similar to images, fonts may change text dimensions:

```typescript
// In plugin view:
document.fonts.ready.then(() => {
  const tr = view.state.tr.setMeta('fontsLoaded', true)
  view.dispatch(tr)
})
```

---

## Next Steps

1. **Create the extension files** in `extensions/pagination/`
2. **Register the extension** with Tiptap editor
3. **Add CSS styles** for page separators
4. **Test with various content types**
5. **Optimize performance** for large documents

---

## File Structure

```
project/
├── extensions/
│   └── pagination/
│       ├── index.ts        # Main exports
│       ├── plugin.ts       # ProseMirror plugin
│       ├── decorations.ts  # Decoration builders
│       ├── measurement.ts  # Height utilities
│       ├── constants.ts    # A4 dimensions
│       ├── types.ts        # TypeScript types
│       └── pagination.css  # Styles
├── components/
│   └── Tiptap.jsx          # Editor component
└── app/
    └── globals.css         # Import pagination.css here
```

---

## Summary

Approach 6 provides the most robust pagination solution by integrating directly with ProseMirror's architecture. The key benefits are:

1. **No DOM manipulation** - Uses decorations instead
2. **Transaction-aware** - Updates on every change
3. **Cacheable** - Height measurements are cached
4. **Clean separation** - Document content vs. visual markers
5. **Print-ready** - CSS handles print layout

This approach requires more upfront work but provides a production-quality pagination system suitable for apps like Google Docs or Notion.
