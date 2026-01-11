# Page Break Implementation Approaches for Tiptap Editor

This document outlines all possible approaches to implement MS Word-like page breaking in a Tiptap/ProseMirror-based document editor. Each approach has its own trade-offs in terms of complexity, performance, and accuracy.

---

## Table of Contents

1. [Approach 1: Line Count Based](#approach-1-line-count-based)
2. [Approach 2: Block/Node Based Measurement](#approach-2-blocknode-based-measurement)
3. [Approach 3: Content Height Calculation](#approach-3-content-height-calculation)
4. [Approach 4: CSS Page Break Properties (Print Only)](#approach-4-css-page-break-properties-print-only)
5. [Approach 5: Virtual Page Rendering with Clipping](#approach-5-virtual-page-rendering-with-clipping)
6. [Approach 6: Custom ProseMirror/Tiptap Extension](#approach-6-custom-prosemirrortiptap-extension)
7. [Approach 7: Hybrid Clone-and-Measure](#approach-7-hybrid-clone-and-measure)
8. [Comparison Matrix](#comparison-matrix)
9. [Test Case Scenarios](#test-case-scenarios)
10. [Final Conclusion](#final-conclusion)

---

## Approach 1: Line Count Based

### Description
Calculate the maximum number of lines that fit on a page based on font size and line height, then track line count and break to a new page when the limit is reached.

### How It Works
```javascript
const PAGE_HEIGHT = 995; // A4 content height in px (after padding)
const LINE_HEIGHT = 28;  // 16px font × 1.75 line-height = 28px
const MAX_LINES_PER_PAGE = Math.floor(PAGE_HEIGHT / LINE_HEIGHT); // ~35 lines

// Track lines as user types
let currentLineCount = 0;
editor.on('update', () => {
  const content = editor.getText();
  const lines = content.split('\n').length;
  const pageCount = Math.ceil(lines / MAX_LINES_PER_PAGE);
});
```

### Pros
- ✅ **Simple to implement** - Basic math calculation
- ✅ **Predictable behavior** - Fixed lines per page
- ✅ **Low performance overhead** - No DOM measurement needed
- ✅ **Easy to understand** - Clear mental model for users

### Cons
- ❌ **Ignores text wrapping** - A long paragraph wrapping to 5 lines counts as 1 line
- ❌ **Ignores different element heights** - H1 takes more space than a paragraph
- ❌ **Ignores images/embeds** - Non-text content breaks the calculation
- ❌ **Inaccurate for rich content** - Lists, blockquotes, code blocks have different spacing

### Complexity
⭐⭐ Low

### Best For
Plain text editors with monospace fonts and no rich formatting.

---

## Approach 2: Block/Node Based Measurement

### Description
Treat each ProseMirror node (paragraph, heading, list, etc.) as a "block" and measure its rendered height. Distribute blocks across pages, breaking to a new page when a block would exceed the remaining space.

### How It Works
```javascript
const CONTENT_HEIGHT = 995; // Available height per page

function calculatePages() {
  const proseMirror = document.querySelector('.ProseMirror');
  const blocks = Array.from(proseMirror.children);
  
  const pages = [];
  let currentPage = { blocks: [], height: 0 };
  
  blocks.forEach((block, idx) => {
    const blockHeight = block.getBoundingClientRect().height;
    
    if (currentPage.height + blockHeight > CONTENT_HEIGHT && currentPage.blocks.length > 0) {
      // Start new page
      pages.push(currentPage);
      currentPage = { blocks: [idx], height: blockHeight };
    } else {
      currentPage.blocks.push(idx);
      currentPage.height += blockHeight;
    }
  });
  
  if (currentPage.blocks.length > 0) {
    pages.push(currentPage);
  }
  
  return pages;
}
```

### Pros
- ✅ **Respects actual element heights** - Headings, paragraphs measured correctly
- ✅ **Works with different content types** - Lists, blockquotes, images
- ✅ **Clean page breaks** - Never splits a block across pages
- ✅ **Moderate complexity** - Uses standard DOM APIs

### Cons
- ❌ **Can't split long paragraphs** - A paragraph taller than a page causes issues
- ❌ **Requires hidden measurement** - Need an off-screen copy for accurate measurement
- ❌ **Content duplication** - Must clone nodes to display on multiple pages
- ❌ **Performance impact** - Many DOM measurements on each update

### Complexity
⭐⭐⭐ Medium

### Best For
Document editors where content is primarily short paragraphs and blocks that don't exceed page height.

---

## Approach 3: Content Height Calculation

### Description
Measure the total rendered height of the editor content and divide by page height to determine page count. Render the content once and use visual overlays to create page boundaries.

### How It Works
```javascript
const CONTENT_HEIGHT = 995;

function calculatePageCount() {
  const proseMirror = document.querySelector('.ProseMirror');
  const totalHeight = proseMirror.scrollHeight;
  return Math.ceil(totalHeight / CONTENT_HEIGHT);
}

// Render page backgrounds based on count
function renderPageBackgrounds(pageCount) {
  return Array.from({ length: pageCount }, (_, i) => (
    <div 
      key={i}
      style={{
        position: 'absolute',
        top: i * (PAGE_HEIGHT + GAP),
        width: A4_WIDTH,
        height: PAGE_HEIGHT,
        background: 'white',
        boxShadow: '...'
      }}
    />
  ));
}
```

### Pros
- ✅ **Simplest implementation** - Just divide height by page size
- ✅ **No content duplication** - Single editor instance
- ✅ **All content is editable** - No read-only cloned regions
- ✅ **Best performance** - Minimal DOM operations

### Cons
- ❌ **Visual-only page breaks** - Content flows continuously, pages are just visual overlays
- ❌ **Content appears cut off** - Text can be split mid-line at page boundaries
- ❌ **No clean breaks** - Unlike Word, paragraphs don't jump to next page
- ❌ **Print issues** - Printing would cut content at arbitrary points

### Complexity
⭐ Very Low

### Best For
Preview-style editors where exact pagination isn't critical during editing.

---

## Approach 4: CSS Page Break Properties (Print Only)

### Description
Use CSS `break-before`, `break-after`, and `break-inside` properties to control page breaks. This only affects printed output, not the on-screen editor.

### How It Works
```css
/* Prevent breaking inside these elements */
.ProseMirror p,
.ProseMirror li,
.ProseMirror blockquote {
  break-inside: avoid;
}

/* Force break before h1 */
.ProseMirror h1 {
  break-before: page;
}

/* Use @page for print styling */
@page {
  size: A4;
  margin: 20mm;
}

@media print {
  .toolbar { display: none; }
  .ProseMirror {
    width: 100%;
    height: auto;
  }
}
```

### Pros
- ✅ **Native browser support** - No JavaScript needed for print
- ✅ **Zero runtime overhead** - CSS only
- ✅ **Perfect for print** - Browser handles all pagination
- ✅ **Standards compliant** - Uses CSS Paged Media spec

### Cons
- ❌ **Print only** - No visual pagination while editing
- ❌ **No WYSIWYG** - User can't see page breaks before printing
- ❌ **Browser inconsistencies** - Different browsers handle breaks differently
- ❌ **Limited control** - Can't override browser's pagination decisions

### Complexity
⭐ Very Low

### Best For
Applications where print output matters but on-screen pagination is not required.

---

## Approach 5: Virtual Page Rendering with Clipping

### Description
Create multiple "page" containers, each acting as a viewport window into the continuous document. Each page clips and offsets the content to show only its portion.

### How It Works
```javascript
const pages = [0, 1, 2, 3]; // Page indices

return pages.map((pageIdx) => (
  <div 
    key={pageIdx}
    className="page"
    style={{
      width: A4_WIDTH,
      height: A4_HEIGHT,
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: -pageIdx * CONTENT_HEIGHT, // Offset to show correct portion
        left: 0,
        width: CONTENT_WIDTH,
      }}
    >
      {/* Same editor content, offset differently per page */}
      <EditorContent editor={editor} />
    </div>
  </div>
));
```

### Pros
- ✅ **True page visualization** - Each page shows a different portion
- ✅ **Continuous content** - Single document, multiple views
- ✅ **Accurate representation** - WYSIWYG-like experience

### Cons
- ❌ **Multiple editor instances issue** - Can't render same editor in multiple places
- ❌ **Complex focus handling** - Which page receives keyboard input?
- ❌ **Content still cut at boundaries** - Paragraphs split mid-line
- ❌ **Sync issues** - Multiple views must stay synchronized

### Complexity
⭐⭐⭐⭐ High

### Best For
Advanced document systems with custom rendering pipelines.

---

## Approach 6: Custom ProseMirror/Tiptap Extension

### Description
Create a custom Tiptap extension that intercepts content changes, measures node heights, and inserts special "page-break" nodes into the document structure at appropriate positions.

### How It Works
```javascript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': '', class: 'page-break' }],
});

const PaginationPlugin = Extension.create({
  name: 'pagination',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pagination'),
        
        appendTransaction(transactions, oldState, newState) {
          // After each transaction, measure content and insert/remove page breaks
          const pageBreaks = calculatePageBreakPositions(newState.doc);
          // Return transaction that updates page break nodes
        },
        
        props: {
          decorations(state) {
            // Add visual decorations at page boundaries
          }
        }
      })
    ];
  }
});
```

### Pros
- ✅ **Integrated with editor** - Part of the document model
- ✅ **Collaborative-friendly** - Page breaks are actual nodes that sync
- ✅ **Full control** - Can implement any breaking logic
- ✅ **Proper document structure** - Page breaks are in the content

### Cons
- ❌ **Very complex** - Requires deep ProseMirror knowledge
- ❌ **Performance sensitive** - Must run on every edit
- ❌ **Measurement challenges** - Nodes must be rendered to measure
- ❌ **Potential loops** - Inserting breaks changes heights, requiring recalculation

### Complexity
⭐⭐⭐⭐⭐ Very High

### Best For
Production document editors like Google Docs or Notion that need perfect pagination.

---

## Approach 7: Hybrid Clone-and-Measure

### Description
Combine approaches 2 and 3: Use a hidden "measurement" copy of the editor to calculate exact block heights, then render the actual document with content distributed across visual page containers.

### How It Works
```javascript
// 1. Hidden editor for measurement (off-screen)
<div ref={measureRef} style={{ position: 'absolute', left: -9999 }}>
  <EditorContent editor={editor} />
</div>

// 2. Calculate which blocks go on which page
function distributeBlocks() {
  const blocks = measureRef.current.querySelectorAll('.ProseMirror > *');
  const pages = [];
  let currentPage = [];
  let currentHeight = 0;
  
  blocks.forEach((block, idx) => {
    const height = block.offsetHeight;
    
    if (currentHeight + height > CONTENT_HEIGHT) {
      pages.push([...currentPage]);
      currentPage = [idx];
      currentHeight = height;
    } else {
      currentPage.push(idx);
      currentHeight += height;
    }
  });
  
  pages.push(currentPage);
  return pages;
}

// 3. Render pages with cloned block content
{pages.map((pageBlocks, pageIdx) => (
  <Page key={pageIdx}>
    {pageBlocks.map(blockIdx => (
      <div 
        key={blockIdx}
        dangerouslySetInnerHTML={{ 
          __html: blocks[blockIdx].outerHTML 
        }}
      />
    ))}
  </Page>
))}
```

### Pros
- ✅ **Accurate measurement** - Real DOM heights
- ✅ **Clean block breaks** - No mid-block splitting
- ✅ **Works with all content** - Images, embeds, etc.
- ✅ **Visual accuracy** - Pages show actual content

### Cons
- ❌ **Only first page is editable** - Subsequent pages are clones
- ❌ **Cursor can scroll off visible pages** - UX complexity
- ❌ **Double DOM** - Hidden + visible copies
- ❌ **Sync complexity** - Must re-clone on every change

### Complexity
⭐⭐⭐ Medium

### Best For
Document preview/print-preview modes where most editing happens on early pages.

---

## Comparison Matrix

| Approach | Accuracy | Performance | Complexity | Editability | Best Use Case |
|----------|----------|-------------|------------|-------------|---------------|
| 1. Line Count | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Plain text |
| 2. Block/Node | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Short blocks |
| 3. Height Calc | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | Visual-only pagination |
| 4. CSS Print | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | N/A | Print output only |
| 5. Virtual Pages | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | Custom renderers |
| 6. PM Extension | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Production apps |
| 7. Hybrid Clone | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Preview modes |

### Legend
- **Accuracy**: How well it matches MS Word behavior
- **Performance**: Runtime efficiency
- **Complexity**: Implementation difficulty
- **Editability**: Can users edit across all pages?

---

## Test Case Scenarios

### Test Case 1: Document with Many Headings (Mixed H1, H2, H3)

**Scenario**: A document with 20+ headings of various sizes, minimal paragraph text.

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Treats all headings as 1 line each, but H1 is ~3x taller than H3. Pagination will be completely wrong. A page might show 35 "lines" but visually overflow because headings take more space. |
| 2. Block/Node | ✅ **YES** | Each heading is measured individually by its actual rendered height. H1's ~56px height vs H3's ~22px height is correctly accounted for. |
| 3. Height Calc | ✅ **YES** | Total height includes all headings correctly. Page count will be accurate, but headings may be cut mid-way at page boundaries. |
| 4. CSS Print | ✅ **YES** | CSS `break-inside: avoid` prevents heading splits during print. Works perfectly for print output. |
| 5. Virtual Pages | ⚠️ **PARTIAL** | Height is calculated correctly, but headings may still be cut at page boundaries visually. |
| 6. PM Extension | ✅ **YES** | Can measure each heading and insert page breaks before headings that would be cut. Best accuracy. |
| 7. Hybrid Clone | ✅ **YES** | Each heading is a separate block that gets measured and distributed. Works well. |

**Winner**: Approach 2, 6, or 7

---

### Test Case 2: Document with Only Headings (No Paragraphs)

**Scenario**: A document containing only H1, H2, H3 headings with no body text.

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Same problem as Test Case 1. Each heading counts as 1 line regardless of actual height. |
| 2. Block/Node | ✅ **YES** | Perfect. Each heading is measured as a separate block. |
| 3. Height Calc | ✅ **YES** | Works, but headings may be cut at page boundaries. |
| 4. CSS Print | ✅ **YES** | Each heading moves to next page if it would be cut. |
| 5. Virtual Pages | ⚠️ **PARTIAL** | Headings may be visually cut at page boundaries. |
| 6. PM Extension | ✅ **YES** | Best result - headings are never cut. |
| 7. Hybrid Clone | ✅ **YES** | Each heading treated as atomic block, distributed correctly. |

**Winner**: Approach 2, 6, or 7

---

### Test Case 3: Document with Images/Attachments

**Scenario**: A document with multiple images of varying sizes, some inline, some block-level.

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Images have no "lines". A 500px tall image would be counted as 0 lines. Pagination completely broken. |
| 2. Block/Node | ✅ **YES** | Images are DOM nodes with measurable heights. `getBoundingClientRect()` gives accurate dimensions. |
| 3. Height Calc | ✅ **YES** | `scrollHeight` includes image heights. Page count accurate, but images may be cut at boundaries. |
| 4. CSS Print | ✅ **YES** | `break-inside: avoid` on images prevents splitting. Browser handles it well. |
| 5. Virtual Pages | ⚠️ **PARTIAL** | Images may be clipped at page boundaries. |
| 6. PM Extension | ✅ **YES** | Can detect image nodes and ensure they fit on pages. |
| 7. Hybrid Clone | ✅ **YES** | Images are blocks that get measured and distributed. Works well. |

**Winner**: Approach 2, 6, or 7

---

### Test Case 4: PDF/Word Export (No Post-Processing)

**Scenario**: Export document to PDF or Word format using only CSS, without JavaScript manipulation of the content.

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Line count is a runtime concept. Export tools won't understand it. |
| 2. Block/Node | ⚠️ **PARTIAL** | Need to render page markers in HTML. Export tool must understand page structure. |
| 3. Height Calc | ❌ **NO** | Visual overlays won't translate to export. Content will run continuously. |
| 4. CSS Print | ✅ **BEST** | **This is the ideal approach for export.** CSS Paged Media is designed for this. `@page`, `break-before`, `break-inside` are understood by PDF generators like Puppeteer, wkhtmltopdf, and browser print-to-PDF. |
| 5. Virtual Pages | ❌ **NO** | Export won't understand viewport clipping. |
| 6. PM Extension | ✅ **YES** | Page break nodes can be exported as `<div class="page-break">` which CSS can style with `break-before: page`. |
| 7. Hybrid Clone | ⚠️ **PARTIAL** | Cloned pages can be exported, but requires special handling. |

**Winner**: Approach 4 (CSS Print) or Approach 6 (PM Extension with CSS)

**Key Insight**: For PDF/Word export without post-processing, **CSS Page Break Properties (Approach 4)** is the only approach that works purely with CSS. Combine it with Approach 2 or 6 for on-screen preview.

---

### Test Case 5: Long Paragraphs That Exceed Page Height

**Scenario**: A single paragraph that is longer than the A4 page content area (995px).

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Counts the paragraph as however many `\n` it contains. Doesn't handle text wrapping. |
| 2. Block/Node | ⚠️ **PARTIAL** | Measures the full block height correctly, but can't split it. The block either overflows or moves to next page (and still overflows). |
| 3. Height Calc | ✅ **YES** | Calculates correct page count, but paragraph is cut visually at page boundary. |
| 4. CSS Print | ✅ **YES** | If `break-inside: avoid` is NOT set, browser will break the paragraph mid-line (like Word does). |
| 5. Virtual Pages | ⚠️ **PARTIAL** | Paragraph is clipped at page boundary. |
| 6. PM Extension | ✅ **BEST** | Can split text nodes at word boundaries. Most complex but most accurate. |
| 7. Hybrid Clone | ⚠️ **PARTIAL** | Can't split blocks. Long paragraph causes problems. |

**Winner**: Approach 4 (for print) or Approach 6 (for on-screen)

---

### Test Case 6: Mixed Content (Headings + Paragraphs + Images + Lists)

**Scenario**: A realistic document with various content types mixed together.

| Approach | Works? | Explanation |
|----------|--------|-------------|
| 1. Line Count | ❌ **NO** | Fails for all non-text content. |
| 2. Block/Node | ✅ **YES** | All block types are DOM nodes that can be measured. |
| 3. Height Calc | ✅ **YES** | Total height works, but no clean breaks. |
| 4. CSS Print | ✅ **YES** | Browser handles mixed content well for print. |
| 5. Virtual Pages | ⚠️ **PARTIAL** | Works but content may be cut. |
| 6. PM Extension | ✅ **YES** | Best handling of all content types. |
| 7. Hybrid Clone | ✅ **YES** | All blocks measured and distributed correctly. |

**Winner**: Approach 2, 6, or 7

---

### Test Case 7: Real-Time Editing Performance

**Scenario**: User is typing quickly, content changes frequently.

| Approach | Performance | Explanation |
|----------|-------------|-------------|
| 1. Line Count | ⭐⭐⭐⭐⭐ | O(1) calculation, no DOM access. |
| 2. Block/Node | ⭐⭐⭐ | Must measure DOM on each change. Debouncing helps. |
| 3. Height Calc | ⭐⭐⭐⭐⭐ | Single `scrollHeight` read. Very fast. |
| 4. CSS Print | ⭐⭐⭐⭐⭐ | No calculations needed during editing. |
| 5. Virtual Pages | ⭐⭐ | Multiple render calculations. |
| 6. PM Extension | ⭐⭐⭐ | Runs on each transaction. Can be optimized. |
| 7. Hybrid Clone | ⭐⭐⭐ | Must re-measure and re-clone on changes. |

**Winner**: Approach 1, 3, or 4 (for performance)

---

## Test Case Summary Matrix

| Test Case | Line Count | Block/Node | Height Calc | CSS Print | Virtual Pages | PM Extension | Hybrid Clone |
|-----------|------------|------------|-------------|-----------|---------------|--------------|--------------|
| Many Headings | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Only Headings | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| With Images | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| PDF Export (CSS only) | ❌ | ⚠️ | ❌ | ✅✅ | ❌ | ✅ | ⚠️ |
| Long Paragraphs | ❌ | ⚠️ | ✅ | ✅ | ⚠️ | ✅✅ | ⚠️ |
| Mixed Content | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Performance | ✅✅ | ✅ | ✅✅ | ✅✅ | ⚠️ | ✅ | ✅ |
| **Total Score** | **1/7** | **5.5/7** | **5.5/7** | **6.5/7** | **2/7** | **7/7** | **5.5/7** |

**Legend**: ✅ = Works, ✅✅ = Best, ⚠️ = Partial, ❌ = Fails

---

## Final Conclusion

### 🏆 Best Overall Approach: **Approach 2 (Block/Node Based) + Approach 4 (CSS Print)**

After analyzing all test cases, the recommendation is to **combine two approaches together**:

> ⚠️ **Important UX Consideration**: Users MUST see page breaks while editing!
> 
> If users can't see where content will break before printing/exporting, they will think the web app is faulty or incomplete. A document editor without visible pagination feels broken.

#### For On-Screen Pagination (WYSIWYG): **Approach 2 (Block/Node Based Measurement)**

**Purpose**: Show users exactly where pages will break **while they are editing**.

**Why?**
- ✅ Users SEE page breaks in real-time while typing
- ✅ Works with headings of all sizes
- ✅ Works with images and embeds
- ✅ Works with mixed content
- ✅ Provides clean page breaks (never cuts blocks mid-content)
- ✅ Reasonable implementation complexity
- ⚠️ Only limitation: can't split very long paragraphs (acceptable trade-off)

**What users see while editing:**
```
┌─────────────────────────────────────┐
│  Page 1                             │
│  ─────────────────────────────────  │
│  Content here...                    │
│  More content...                    │
│                                     │
│  A4 • 210mm × 297mm    Page 1 of 3  │
└─────────────────────────────────────┘
         ↓ visible gap ↓
┌─────────────────────────────────────┐
│  Page 2                             │
│  ─────────────────────────────────  │
│  Content continues here...          │
│                                     │
│  A4 • 210mm × 297mm    Page 2 of 3  │
└─────────────────────────────────────┘
```

#### For PDF/Word Export: **Approach 4 (CSS Page Break Properties)**

**Purpose**: Ensure exported PDF/Word documents break correctly **at the same positions** users saw while editing.

**Why?**
- ✅ Zero JavaScript required for export
- ✅ Native browser and PDF generator support
- ✅ Works with all content types
- ✅ Properly splits long content that exceeds page height
- ✅ Standard CSS Paged Media specification
- ✅ Puppeteer, wkhtmltopdf, browser Print-to-PDF all understand CSS page breaks

### Implementation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    RECOMMENDED SOLUTION                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────┐    ┌──────────────────────────┐  │
│   │   ON-SCREEN EDITOR   │    │    PDF/PRINT EXPORT      │  │
│   ├──────────────────────┤    ├──────────────────────────┤  │
│   │                      │    │                          │  │
│   │  Approach 2:         │    │  Approach 4:             │  │
│   │  Block/Node Based    │    │  CSS Page Break          │  │
│   │  Measurement         │    │  Properties              │  │
│   │                      │    │                          │  │
│   │  • Measure blocks    │    │  • break-inside: avoid   │  │
│   │  • Distribute to     │    │  • break-before: page    │  │
│   │    visual pages      │    │  • @page { size: A4 }    │  │
│   │  • Show page numbers │    │  • @media print {...}    │  │
│   │                      │    │                          │  │
│   └──────────────────────┘    └──────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Alternative: For Production-Quality Apps

If you need **Google Docs-level accuracy** and can afford longer development time:

**Approach 6 (Custom ProseMirror Extension)** is the ultimate solution but requires:
- Deep ProseMirror knowledge
- 2-4 weeks of development
- Careful performance optimization

### What NOT to Use

❌ **Approach 1 (Line Count)** - Fails for any rich content  
❌ **Approach 5 (Virtual Pages)** - Too complex, content still gets cut

---

## Quick Start Implementation

To implement the recommended solution (Approach 2 + 4), here's the priority order:

1. **First**: Implement CSS print styles (Approach 4) - ensures PDF export works immediately
2. **Second**: Add block measurement logic (Approach 2) - for on-screen pagination
3. **Third**: Handle edge cases (long paragraphs, images loading)
4. **Optional**: Upgrade to PM Extension (Approach 6) for production polish

**Estimated Development Time**:
- Approach 2 + 4 Combined: **2-3 days**
- Full Approach 6: **2-4 weeks**
