'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Undo,
  Redo,
  Quote,
  Code,
  Minus,
  FileText,
  SeparatorHorizontal,
  Download,
  Loader2,
} from 'lucide-react'
import { exportToPDF } from '@/lib/pdfExport'

// ==================== CONSTANTS ====================
const A4_WIDTH = 794
const A4_HEIGHT = 1123
const PAGE_MARGIN_TOP = 64
const PAGE_MARGIN_BOTTOM = 64
const PAGE_MARGIN_LEFT = 64
const PAGE_MARGIN_RIGHT = 64
const CONTENT_HEIGHT = A4_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM // 995px
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT // 666px
const PAGE_GAP = 40

// Default height estimates for different node types
const HEIGHT_ESTIMATES = {
  paragraph: 28, // ~16px font * 1.75 line-height
  heading1: 56,
  heading2: 44,
  heading3: 36,
  listItem: 28,
  blockquote: 60,
  codeBlock: 80,
  horizontalRule: 40,
  pageBreak: 0, // Forces page break, no height
  default: 28,
}

// ==================== PAGINATION PLUGIN ====================
const paginationPluginKey = new PluginKey('pagination')

function estimateNodeHeight(node) {
  const type = node.type.name

  switch (type) {
    case 'heading':
      const level = node.attrs.level
      if (level === 1) return HEIGHT_ESTIMATES.heading1
      if (level === 2) return HEIGHT_ESTIMATES.heading2
      return HEIGHT_ESTIMATES.heading3

    case 'paragraph':
      // Estimate based on content length
      const textLength = node.textContent.length
      const charsPerLine = 70
      const lines = Math.max(1, Math.ceil(textLength / charsPerLine))
      return lines * HEIGHT_ESTIMATES.paragraph + 16 // margin

    case 'bulletList':
    case 'orderedList':
      let listHeight = 16 // margin
      node.forEach((child) => {
        listHeight += estimateNodeHeight(child)
      })
      return listHeight

    case 'listItem':
      let itemHeight = 0
      node.forEach((child) => {
        itemHeight += estimateNodeHeight(child)
      })
      return Math.max(HEIGHT_ESTIMATES.listItem, itemHeight)

    case 'blockquote':
      let quoteHeight = 32 // padding
      node.forEach((child) => {
        quoteHeight += estimateNodeHeight(child)
      })
      return quoteHeight

    case 'codeBlock':
      const codeLines = (node.textContent.match(/\n/g) || []).length + 1
      return codeLines * 24 + 32

    case 'horizontalRule':
      return HEIGHT_ESTIMATES.horizontalRule

    case 'hardBreak':
      return HEIGHT_ESTIMATES.paragraph

    default:
      return HEIGHT_ESTIMATES.default
  }
}

function calculatePageBreaks(doc) {
  const pageBreaks = []
  let currentPageHeight = 0
  let currentPageNumber = 1

  doc.forEach((node, offset) => {
    const nodeHeight = estimateNodeHeight(node)

    // Check if adding this node would exceed page height
    if (currentPageHeight + nodeHeight > CONTENT_HEIGHT && currentPageHeight > 0) {
      // We need a page break before this node
      pageBreaks.push({
        pos: offset,
        pageNumber: currentPageNumber,
        remainingSpace: CONTENT_HEIGHT - currentPageHeight,
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

function createPageBreakDecoration(pos, pageNumber, totalPages, remainingSpace) {
  return Decoration.widget(pos, (view) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'pm-page-break-widget'
    wrapper.contentEditable = 'false'
    wrapper.setAttribute('data-page-number', String(pageNumber))

    // Calculate total gap height (remaining space + gap + new page top margin)
    const gapHeight = remainingSpace + PAGE_GAP + PAGE_MARGIN_BOTTOM + PAGE_MARGIN_TOP

    wrapper.style.cssText = `
      display: block;
      width: calc(100% + ${PAGE_MARGIN_LEFT + PAGE_MARGIN_RIGHT}px);
      margin-left: -${PAGE_MARGIN_LEFT}px;
      height: ${gapHeight}px;
      position: relative;
      pointer-events: none;
      user-select: none;
    `

    wrapper.innerHTML = `
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: ${remainingSpace}px;
        background: transparent;
      "></div>
      <div style="
        position: absolute;
        top: ${remainingSpace}px;
        left: 0;
        right: 0;
        padding: 0 ${PAGE_MARGIN_LEFT}px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #9ca3af;
      ">
        <span>A4 • 210mm × 297mm</span>
        <span>Page ${pageNumber} of ${totalPages}</span>
      </div>
      <div style="
        position: absolute;
        top: ${remainingSpace + 20}px;
        left: 0;
        right: 0;
        height: ${PAGE_GAP}px;
        background: linear-gradient(to bottom, 
          rgba(226, 232, 240, 0) 0%,
          rgb(226, 232, 240) 20%,
          rgb(226, 232, 240) 80%,
          rgba(226, 232, 240, 0) 100%
        );
      "></div>
      <div style="
        position: absolute;
        top: ${remainingSpace + PAGE_GAP + PAGE_MARGIN_BOTTOM}px;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(to right, #6366f1, #a855f7, #ec4899);
        opacity: 0.3;
      "></div>
    `

    return wrapper
  }, {
    side: -1,
    key: `page-break-${pageNumber}`,
  })
}

function paginationPlugin() {
  return new Plugin({
    key: paginationPluginKey,

    state: {
      init(_, state) {
        const { pageBreaks, pageCount } = calculatePageBreaks(state.doc)
        return { pageBreaks, pageCount }
      },

      apply(tr, value, oldState, newState) {
        // Only recalculate if document changed
        if (!tr.docChanged) {
          return value
        }

        const { pageBreaks, pageCount } = calculatePageBreaks(newState.doc)
        return { pageBreaks, pageCount }
      },
    },

    props: {
      decorations(state) {
        const pluginState = paginationPluginKey.getState(state)
        if (!pluginState || pluginState.pageBreaks.length === 0) {
          return DecorationSet.empty
        }

        const decorations = pluginState.pageBreaks.map((pb) =>
          createPageBreakDecoration(
            pb.pos,
            pb.pageNumber,
            pluginState.pageCount,
            pb.remainingSpace
          )
        )

        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

// ==================== PAGINATION EXTENSION ====================
const Pagination = Extension.create({
  name: 'pagination',

  addProseMirrorPlugins() {
    return [paginationPlugin()]
  },

  addStorage() {
    return {
      pageCount: 1,
    }
  },

  onUpdate() {
    const pluginState = paginationPluginKey.getState(this.editor.state)
    if (pluginState) {
      this.storage.pageCount = pluginState.pageCount
    }
  },
})

// ==================== PAGE BREAK NODE ====================
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-manual-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-manual-page-break': 'true',
      'class': 'manual-page-break',
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

// ==================== TOOLBAR COMPONENTS ====================
const ToolbarButton = ({ onClick, isActive, disabled, children, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded-lg transition-all duration-200 
      ${isActive
        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      flex items-center justify-center
    `}
  >
    {children}
  </button>
)

const ToolbarDivider = () => (
  <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1" />
)

// ==================== MAIN COMPONENT ====================
const Tiptap = () => {
  const [pageCount, setPageCount] = useState(1)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Pagination,
      PageBreak,
    ],
    immediatelyRender: false,
    content: `
      <h1>Welcome to Your Document</h1>
      <p>This is a professional document editor with <strong>proper A4 page layout</strong> and <strong>automatic page breaking</strong> using ProseMirror decorations.</p>
      <h2>How It Works</h2>
      <p>This editor uses <strong>Approach 6: Custom ProseMirror Extension</strong> for pagination. Unlike DOM manipulation approaches, this uses ProseMirror's decoration system which:</p>
      <ul>
        <li><strong>Never modifies the document</strong> - decorations are visual only</li>
        <li><strong>No infinite loops</strong> - decorations don't trigger recalculation</li>
        <li><strong>Clean separation</strong> - content vs. pagination markers</li>
        <li><strong>Transaction-aware</strong> - updates only when document changes</li>
      </ul>
      <h2>Try It Out</h2>
      <p>Start typing or press Enter multiple times to see automatic page breaks appear. Each page shows proper margins and page numbers.</p>
      <blockquote><p><strong>Pro tip:</strong> Use the Page Break button in the toolbar to force a manual page break.</p></blockquote>
      <p>Paragraph 1</p>
      <p>Paragraph 2</p>
      <p>Paragraph 3</p>
      <p>Paragraph 4</p>
      <p>Paragraph 5</p>
      <p>Paragraph 6</p>
      <p>Paragraph 7</p>
      <p>Paragraph 8</p>
      <p>Paragraph 9</p>
      <p>Paragraph 10</p>
    `,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // Update page count from plugin state
      const pluginState = paginationPluginKey.getState(editor.state)
      if (pluginState) {
        setPageCount(pluginState.pageCount)
      }
    },
  })

  // Initial page count
  useEffect(() => {
    if (editor) {
      const pluginState = paginationPluginKey.getState(editor.state)
      if (pluginState) {
        setPageCount(pluginState.pageCount)
      }
    }
  }, [editor])

  const setTextAlign = useCallback((alignment) => {
    if (editor) {
      editor.chain().focus().setTextAlign(alignment).run()
    }
  }, [editor])

  const insertPageBreak = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertPageBreak().run()
    }
  }, [editor])

  // PDF Export State
  const [isExporting, setIsExporting] = useState(false)

  // Handle PDF Export
  const handleExportPDF = useCallback(async () => {
    if (!editor || isExporting) return

    setIsExporting(true)
    try {
      await exportToPDF(editor, {
        filename: 'document.pdf',
        includePageNumbers: true
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [editor, isExporting])

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-gray-500 font-medium">Loading editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100">
      {/* Toolbar */}
      <div className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-lg shadow-gray-100/50">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            {/* History */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo"
              >
                <Undo size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo"
              >
                <Redo size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Text Formatting */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
              >
                <Bold size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
              >
                <Italic size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Underline"
              >
                <UnderlineIcon size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
              >
                <Strikethrough size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
                title="Highlight"
              >
                <Highlighter size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Code"
              >
                <Code size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Headings */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                <Heading1 size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                <Heading2 size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
              >
                <Heading3 size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Lists */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                <List size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                <ListOrdered size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Alignment */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => setTextAlign('left')}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Align Left"
              >
                <AlignLeft size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setTextAlign('center')}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Align Center"
              >
                <AlignCenter size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setTextAlign('right')}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Align Right"
              >
                <AlignRight size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setTextAlign('justify')}
                isActive={editor.isActive({ textAlign: 'justify' })}
                title="Justify"
              >
                <AlignJustify size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Block Elements */}
            <div className="flex items-center gap-0.5 bg-gray-50/80 rounded-xl p-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
              >
                <Quote size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
              >
                <Minus size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={insertPageBreak}
                title="Insert Page Break"
              >
                <SeparatorHorizontal size={18} />
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            {/* Page Info */}
            <div className="flex items-center gap-2 bg-indigo-50/80 rounded-xl px-3 py-1.5">
              <FileText size={16} className="text-indigo-500" />
              <span className="text-sm font-medium text-indigo-700">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            </div>

            <ToolbarDivider />

            {/* Export PDF Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                transition-all duration-300 shadow-lg
                ${isExporting
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600'
                }
              `}
              title="Export to PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Editor Container */}
      <div className="py-8 px-4">
        <div
          className="editor-page-container bg-white shadow-xl shadow-gray-300/50 relative"
          style={{
            width: `${A4_WIDTH}px`,
            minHeight: `${A4_HEIGHT}px`,
            padding: `${PAGE_MARGIN_TOP}px ${PAGE_MARGIN_RIGHT}px ${PAGE_MARGIN_BOTTOM}px ${PAGE_MARGIN_LEFT}px`,
          }}
        >
          {/* Top accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: 'linear-gradient(to right, #6366f1, #a855f7, #ec4899)',
              opacity: 0.3,
            }}
          />

          <EditorContent
            editor={editor}
            className="editor-content"
            style={{ width: `${CONTENT_WIDTH}px` }}
          />

          {/* First page footer (only shows if single page) */}
          {pageCount === 1 && (
            <div
              className="absolute bottom-4 left-0 right-0 flex justify-between px-8"
              style={{ pointerEvents: 'none' }}
            >
              <span className="text-xs text-gray-300 font-medium">A4 • 210mm × 297mm</span>
              <span className="text-xs text-gray-400 font-medium">Page 1 of 1</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .editor-content .ProseMirror {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 16px;
          line-height: 1.75;
          color: #1f2937;
          width: ${CONTENT_WIDTH}px;
          min-height: 400px;
        }

        .editor-content .ProseMirror:focus {
          outline: none;
        }

        .editor-content .ProseMirror p {
          margin-bottom: 1em;
          min-height: 1.75em;
        }

        .editor-content .ProseMirror h1 {
          font-size: 2.25rem;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 1rem;
          color: #111827;
          line-height: 1.2;
        }

        .editor-content .ProseMirror h2 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #1f2937;
          line-height: 1.3;
        }

        .editor-content .ProseMirror h3 {
          font-size: 1.375rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #374151;
          line-height: 1.4;
        }

        .editor-content .ProseMirror ul,
        .editor-content .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 1em;
        }

        .editor-content .ProseMirror ul { list-style-type: disc; }
        .editor-content .ProseMirror ol { list-style-type: decimal; }

        .editor-content .ProseMirror li {
          margin-bottom: 0.25em;
        }

        .editor-content .ProseMirror li p {
          margin-bottom: 0.25em;
        }

        .editor-content .ProseMirror blockquote {
          border-left: 4px solid;
          border-image: linear-gradient(to bottom, #6366f1, #a855f7) 1;
          margin: 1.5rem 0;
          padding: 1rem;
          font-style: italic;
          color: #4b5563;
          background: linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent);
          border-radius: 0 0.5rem 0.5rem 0;
        }

        .editor-content .ProseMirror blockquote p {
          margin-bottom: 0;
        }

        .editor-content .ProseMirror code {
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
          color: #dc2626;
          padding: 0.2em 0.4em;
          border-radius: 0.375rem;
          font-size: 0.875em;
        }

        .editor-content .ProseMirror mark {
          background: linear-gradient(120deg, #fef08a, #fde047);
          padding: 0.1em 0.2em;
          border-radius: 0.25rem;
        }

        .editor-content .ProseMirror hr {
          border: none;
          height: 2px;
          background: linear-gradient(to right, transparent, #d1d5db, transparent);
          margin: 2rem 0;
        }

        .editor-content .ProseMirror strong {
          font-weight: 600;
          color: #111827;
        }

        /* Manual page break marker */
        .manual-page-break {
          display: block;
          height: 32px;
          margin: 16px 0;
          border: 2px dashed #6366f1;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
          position: relative;
        }

        .manual-page-break::after {
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

        /* ProseMirror decoration widget styles */
        .pm-page-break-widget {
          /* Styles applied inline via createElement */
        }

        /* Selection */
        .editor-content .ProseMirror ::selection {
          background: rgba(99, 102, 241, 0.2);
        }

        /* Placeholder */
        .editor-content .ProseMirror p.is-editor-empty:first-child::before {
          content: 'Start typing...';
          color: #9ca3af;
          float: left;
          pointer-events: none;
          height: 0;
        }

        /* Word break */
        .editor-content .ProseMirror {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        /* Print styles */
        @media print {
          .sticky { display: none !important; }
          body { background: white !important; }
          
          .pm-page-break-widget {
            display: block !important;
            break-after: always;
            page-break-after: always;
            height: 0 !important;
            overflow: hidden;
          }
          
          .manual-page-break {
            break-after: always;
            page-break-after: always;
            height: 0;
            border: none;
            visibility: hidden;
          }

          h1, h2, h3 {
            break-after: avoid;
            page-break-after: avoid;
          }

          p, li, blockquote {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}

export default Tiptap
