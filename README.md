# 📝 TipTap Word Processor

A professional **A4 document editor** built with TipTap, React, and Next.js featuring automatic page breaking, real-time pagination preview, and high-fidelity PDF export.

![Next.js](https://img.shields.io/badge/Next.js-13.5-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)
![TipTap](https://img.shields.io/badge/TipTap-3.15-purple?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3-38B2AC?style=flat-square&logo=tailwind-css)

---

## ✨ Features

### 📄 Professional A4 Page Layout
- **Accurate A4 dimensions** (794×1123 pixels at 96 DPI)
- **Proper page margins** (64px on all sides)
- **Real-time page count** displayed in the toolbar
- **Visual page breaks** with gradient separators

### 🔄 Automatic Page Breaking
- **Custom ProseMirror plugin** for intelligent pagination
- **Decoration-based approach** - content is never modified
- **Height estimation** for accurate page break prediction
- **Manual page break insertion** via toolbar button

### 🎨 Rich Text Formatting
| Feature | Shortcut |
|---------|----------|
| **Bold** | `Ctrl/Cmd + B` |
| *Italic* | `Ctrl/Cmd + I` |
| <u>Underline</u> | `Ctrl/Cmd + U` |
| ~~Strikethrough~~ | - |
| `Code` | - |
| ==Highlight== | - |
| Headings (H1-H3) | - |
| Bullet Lists | - |
| Numbered Lists | - |
| Blockquotes | - |
| Horizontal Rules | - |

### 📐 Text Alignment
- Left align
- Center align
- Right align
- Justify

### 📤 PDF Export
- **Pixel-perfect export** using `html2canvas`
- **Preserves all formatting** exactly as displayed
- **Multi-page support** with automatic pagination
- **Page numbers** in footer
- **High-quality output** with configurable DPI

### ↩️ Undo/Redo
- Full history support
- Keyboard shortcuts (`Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tiptap-word-processor.git
   cd tiptap-word-processor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Build for Production

```bash
npm run build
npm start
```

---

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
│
├── components/
│   ├── Tiptap.jsx          # Main editor component
│   │   ├── Pagination Plugin   # Custom ProseMirror plugin
│   │   ├── PageBreak Node      # Manual page break extension
│   │   └── Toolbar Components  # Formatting buttons
│   └── ui/                 # Shadcn/UI components
│
├── lib/
│   ├── pdfExport.ts        # PDF export using html2canvas
│   └── utils.ts            # Utility functions
│
├── hooks/                  # Custom React hooks
├── public/                 # Static assets
└── tailwind.config.ts      # Tailwind configuration
```

---

## 🔧 Technical Implementation

### Pagination System

The editor uses a custom **ProseMirror decoration system** for pagination:

```javascript
// Height estimates for different node types (in pixels)
const HEIGHT_ESTIMATES = {
  paragraph: 28,      // ~16px font × 1.75 line-height
  heading1: 56,
  heading2: 44,
  heading3: 36,
  listItem: 28,
  blockquote: 60,
  horizontalRule: 40,
};

// Content area: 995px (A4 height - margins)
const CONTENT_HEIGHT = 1123 - 64 - 64;
```

**Key advantages of this approach:**
- ✅ **Never modifies the document** - decorations are visual only
- ✅ **No infinite loops** - decorations don't trigger recalculation
- ✅ **Clean separation** - content vs. pagination markers
- ✅ **Transaction-aware** - updates only when document changes

### PDF Export

The PDF export uses **DOM capture** with `html2canvas` for pixel-perfect output:

```typescript
import { exportToPDF } from '@/lib/pdfExport';

// Export with options
await exportToPDF(editor, {
  filename: 'my-document.pdf',
  includePageNumbers: true,
  quality: 2  // 1-4, higher = better quality
});
```

**How it works:**
1. Calculates page breaks using the same logic as the web UI
2. Creates off-screen containers for each page
3. Clones and renders content for each page
4. Captures each page with `html2canvas`
5. Combines into a multi-page PDF using `jspdf`

---

## 📦 Dependencies

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 13.5.1 | React framework |
| `react` | 18.2.0 | UI library |
| `typescript` | 5.2.2 | Type safety |

### Editor
| Package | Version | Purpose |
|---------|---------|---------|
| `@tiptap/react` | 3.15.3 | TipTap React integration |
| `@tiptap/starter-kit` | 3.15.3 | Essential extensions |
| `@tiptap/extension-underline` | 3.15.3 | Underline support |
| `@tiptap/extension-text-align` | 3.15.3 | Text alignment |
| `@tiptap/extension-highlight` | 3.15.3 | Text highlighting |
| `@tiptap/pm` | 3.15.3 | ProseMirror core |

### PDF Export
| Package | Version | Purpose |
|---------|---------|---------|
| `jspdf` | 4.0.0 | PDF generation |
| `html2canvas` | 1.4.1 | DOM to canvas |

### UI
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | 3.3.3 | Utility CSS |
| `lucide-react` | 0.446.0 | Icons |
| `@radix-ui/*` | Various | Accessible components |

---

## 🎨 Customization

### Change Page Dimensions

Edit the constants in `components/Tiptap.jsx`:

```javascript
// A4 at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// Letter size at 96 DPI (uncomment to use)
// const A4_WIDTH = 816;
// const A4_HEIGHT = 1056;

// Margins
const PAGE_MARGIN_TOP = 64;
const PAGE_MARGIN_BOTTOM = 64;
const PAGE_MARGIN_LEFT = 64;
const PAGE_MARGIN_RIGHT = 64;
```

### Customize Styles

Edit the global styles in `components/Tiptap.jsx`:

```css
/* Heading styles */
.editor-content .ProseMirror h1 {
  font-size: 2.25rem;
  font-weight: 700;
  color: #111827;
}

/* Blockquote */
.editor-content .ProseMirror blockquote {
  border-left: 4px solid;
  border-image: linear-gradient(to bottom, #6366f1, #a855f7) 1;
  background: linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent);
}
```

### Add New Extensions

```javascript
import { Extension } from '@tiptap/core';

const CustomExtension = Extension.create({
  name: 'customExtension',
  // ... extension logic
});

// Add to editor
const editor = useEditor({
  extensions: [
    StarterKit,
    CustomExtension,
    // ... other extensions
  ],
});
```

---

## 🚀 Deployment

### Netlify

The project includes a `netlify.toml` configuration:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Deploy with:
```bash
netlify deploy --prod
```

### Vercel

```bash
vercel deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📝 API Reference

### `exportToPDF(editor, options)`

Exports the editor content to a PDF file.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `editor` | `Editor` | required | TipTap editor instance |
| `options.filename` | `string` | `'document.pdf'` | Output filename |
| `options.includePageNumbers` | `boolean` | `true` | Show page numbers in footer |
| `options.quality` | `number` | `2` | Render quality (1-4) |

**Example:**

```typescript
await exportToPDF(editor, {
  filename: 'my-report.pdf',
  includePageNumbers: true,
  quality: 3
});
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [TipTap](https://tiptap.dev/) - Headless rich-text editor
- [ProseMirror](https://prosemirror.net/) - Core editing framework
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation
- [html2canvas](https://html2canvas.hertzen.com/) - DOM capture
- [Lucide](https://lucide.dev/) - Beautiful icons
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Radix UI](https://www.radix-ui.com/) - Accessible components

---

<div align="center">
  <p>Made with ❤️ using TipTap + Next.js</p>
  <p>
    <a href="#-features">Features</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-technical-implementation">Technical Details</a> •
    <a href="#-customization">Customization</a>
  </p>
</div>
