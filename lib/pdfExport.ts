/**
 * High-Quality PDF Export using DOM Capture
 * 
 * This module provides pixel-perfect PDF export for the TipTap word editor
 * by capturing the actual rendered DOM using html2canvas.
 * 
 * This ensures exact matching of:
 * - Text wrapping and line breaks
 * - Font styles, sizes, and weights
 * - Spacing and padding
 * - All CSS effects
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Editor } from '@tiptap/react';

// ==================== CONSTANTS MATCHING WEB UI ====================
// Web UI dimensions in pixels at 96 DPI
const WEB_A4_WIDTH_PX = 794;
const WEB_A4_HEIGHT_PX = 1123;
const WEB_PAGE_MARGIN_TOP_PX = 64;
const WEB_PAGE_MARGIN_BOTTOM_PX = 64;
const WEB_PAGE_MARGIN_LEFT_PX = 64;
const WEB_PAGE_MARGIN_RIGHT_PX = 64;
const WEB_CONTENT_HEIGHT_PX = WEB_A4_HEIGHT_PX - WEB_PAGE_MARGIN_TOP_PX - WEB_PAGE_MARGIN_BOTTOM_PX; // 995px
const WEB_CONTENT_WIDTH_PX = WEB_A4_WIDTH_PX - WEB_PAGE_MARGIN_LEFT_PX - WEB_PAGE_MARGIN_RIGHT_PX; // 666px

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Height estimates matching the web UI pagination plugin
const HEIGHT_ESTIMATES = {
    paragraph: 28,
    heading1: 56,
    heading2: 44,
    heading3: 36,
    listItem: 28,
    blockquote: 60,
    horizontalRule: 40,
    pageBreak: 0,
    default: 28,
};

interface PDFExportOptions {
    filename?: string;
    includePageNumbers?: boolean;
    quality?: number; // 1-4, higher = better quality but larger file
}

/**
 * Estimate node height in pixels (matching web UI pagination)
 */
function estimateNodeHeight(node: Element): number {
    const tagName = node.tagName.toLowerCase();

    if (tagName === 'h1') return HEIGHT_ESTIMATES.heading1;
    if (tagName === 'h2') return HEIGHT_ESTIMATES.heading2;
    if (tagName === 'h3') return HEIGHT_ESTIMATES.heading3;
    if (tagName === 'blockquote') return HEIGHT_ESTIMATES.blockquote;
    if (tagName === 'hr') return HEIGHT_ESTIMATES.horizontalRule;
    if (tagName === 'ul' || tagName === 'ol') {
        const items = node.querySelectorAll('li');
        return 16 + items.length * HEIGHT_ESTIMATES.listItem;
    }
    if (tagName === 'p') {
        const text = node.textContent || '';
        const lines = Math.max(1, Math.ceil(text.length / 70));
        return lines * HEIGHT_ESTIMATES.paragraph + 16;
    }
    if (node.classList.contains('manual-page-break')) {
        return HEIGHT_ESTIMATES.pageBreak;
    }

    return HEIGHT_ESTIMATES.default;
}

/**
 * Calculate which nodes belong to which page
 */
function calculatePageBreaks(contentElement: Element): number[][] {
    const children = Array.from(contentElement.children);
    const pages: number[][] = [];
    let currentPage: number[] = [];
    let currentHeight = 0;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // Skip page break widgets (decorations)
        if (child.classList.contains('pm-page-break-widget')) {
            continue;
        }

        // Handle manual page breaks
        if (child.classList.contains('manual-page-break')) {
            if (currentPage.length > 0) {
                pages.push(currentPage);
                currentPage = [];
                currentHeight = 0;
            }
            continue;
        }

        const nodeHeight = estimateNodeHeight(child);

        if (currentHeight + nodeHeight > WEB_CONTENT_HEIGHT_PX && currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [i];
            currentHeight = nodeHeight;
        } else {
            currentPage.push(i);
            currentHeight += nodeHeight;
        }
    }

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    return pages;
}

/**
 * Create a styled container for rendering
 */
function createRenderContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: ${WEB_A4_WIDTH_PX}px;
        min-height: ${WEB_A4_HEIGHT_PX}px;
        background: white;
        padding: ${WEB_PAGE_MARGIN_TOP_PX}px ${WEB_PAGE_MARGIN_RIGHT_PX}px ${WEB_PAGE_MARGIN_BOTTOM_PX}px ${WEB_PAGE_MARGIN_LEFT_PX}px;
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    document.body.appendChild(container);
    return container;
}

/**
 * Copy styles from source to target elements recursively
 */
function copyStyles(source: Element, target: Element): void {
    const sourceStyles = window.getComputedStyle(source);
    const targetElement = target as HTMLElement;

    // Copy essential styles
    const stylesToCopy = [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'color', 'backgroundColor', 'textAlign', 'lineHeight',
        'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
        'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
        'borderLeft', 'borderRight', 'borderTop', 'borderBottom',
        'borderRadius', 'textDecoration', 'listStyleType',
        'display', 'width', 'maxWidth'
    ];

    stylesToCopy.forEach(style => {
        (targetElement.style as any)[style] = (sourceStyles as any)[style];
    });

    // Recursively copy for children
    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children);

    for (let i = 0; i < Math.min(sourceChildren.length, targetChildren.length); i++) {
        copyStyles(sourceChildren[i], targetChildren[i]);
    }
}

/**
 * Add page number footer to container
 */
function addPageNumber(container: HTMLDivElement, pageNum: number, totalPages: number): void {
    const footer = document.createElement('div');
    footer.style.cssText = `
        position: absolute;
        bottom: ${WEB_PAGE_MARGIN_BOTTOM_PX / 2}px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        color: #9ca3af;
    `;
    footer.textContent = `Page ${pageNum} of ${totalPages}`;
    container.appendChild(footer);
}

/**
 * Main export function using DOM capture
 */
export async function exportToPDF(
    editor: Editor,
    options: PDFExportOptions = {}
): Promise<void> {
    const {
        filename = 'document.pdf',
        includePageNumbers = true,
        quality = 2
    } = options;

    // Find the editor content element
    const editorElement = document.querySelector('.editor-content .ProseMirror');
    if (!editorElement) {
        console.error('Editor content not found');
        return;
    }

    // Get all content children
    const children = Array.from(editorElement.children).filter(
        child => !child.classList.contains('pm-page-break-widget')
    );

    if (children.length === 0) {
        console.warn('No content to export');
        return;
    }

    // Calculate page breaks
    const pageBreaks = calculatePageBreaks(editorElement);
    const totalPages = pageBreaks.length;

    console.log(`Exporting ${children.length} elements across ${totalPages} pages`);

    // Create PDF
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Render each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
            pdf.addPage();
        }

        const nodeIndices = pageBreaks[pageIndex];

        // Create render container
        const container = createRenderContainer();
        container.style.position = 'relative';
        container.style.height = `${WEB_A4_HEIGHT_PX}px`;

        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = `
            width: ${WEB_CONTENT_WIDTH_PX}px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 16px;
            line-height: 1.75;
            color: #1f2937;
        `;

        // Clone and add nodes for this page
        const allChildren = Array.from(editorElement.children);
        for (const idx of nodeIndices) {
            const sourceNode = allChildren[idx];
            if (sourceNode && !sourceNode.classList.contains('pm-page-break-widget')) {
                const clone = sourceNode.cloneNode(true) as Element;
                copyStyles(sourceNode, clone);
                contentWrapper.appendChild(clone);
            }
        }

        container.appendChild(contentWrapper);

        // Add page number
        if (includePageNumbers) {
            addPageNumber(container, pageIndex + 1, totalPages);
        }

        // Wait for fonts to load
        await document.fonts.ready;

        // Capture with html2canvas
        try {
            const canvas = await html2canvas(container, {
                scale: quality,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: WEB_A4_WIDTH_PX,
                height: WEB_A4_HEIGHT_PX,
            });

            // Add to PDF
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
        } catch (error) {
            console.error(`Error rendering page ${pageIndex + 1}:`, error);
        }

        // Cleanup
        document.body.removeChild(container);
    }

    // Save PDF
    pdf.save(filename);
    console.log('PDF export complete!');
}

/**
 * Alternative: Direct DOM capture of the visible editor
 * This captures exactly what the user sees, page by page
 */
export async function exportVisibleToPDF(
    options: PDFExportOptions = {}
): Promise<void> {
    const {
        filename = 'document.pdf',
        quality = 2
    } = options;

    // Find the page container
    const pageContainer = document.querySelector('.editor-page-container');
    if (!pageContainer) {
        console.error('Page container not found');
        return;
    }

    // Create PDF
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Capture the entire editor as-is
    await document.fonts.ready;

    try {
        const canvas = await html2canvas(pageContainer as HTMLElement, {
            scale: quality,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
        });

        // Calculate how many pages we need based on canvas height
        const pageHeightPx = WEB_A4_HEIGHT_PX;
        const totalHeight = canvas.height / quality;
        const numPages = Math.ceil(totalHeight / pageHeightPx);

        for (let i = 0; i < numPages; i++) {
            if (i > 0) {
                pdf.addPage();
            }

            // Create a canvas for this page
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = pageHeightPx * quality;

            const ctx = pageCanvas.getContext('2d');
            if (ctx) {
                // Fill with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

                // Draw the portion of the main canvas for this page
                ctx.drawImage(
                    canvas,
                    0, i * pageHeightPx * quality, // Source x, y
                    canvas.width, pageHeightPx * quality, // Source width, height
                    0, 0, // Dest x, y
                    pageCanvas.width, pageHeightPx * quality // Dest width, height
                );

                const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
            }
        }

        pdf.save(filename);
        console.log('PDF export complete!');
    } catch (error) {
        console.error('Error exporting PDF:', error);
    }
}

export type { PDFExportOptions };
