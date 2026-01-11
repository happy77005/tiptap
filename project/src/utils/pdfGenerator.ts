import { jsPDF } from 'jspdf';
import { MonthData, getWeekdayNames } from './calendar';

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;

// Base layout configuration
const BASE_MARGIN = 8;

// Grid layout: 3 columns x 4 rows
const COLS = 3;
const ROWS = 4;

// Colors
const BLACK = '#000000';
const GRAY_LIGHT = '#cccccc';

// PDF Options interface
export interface PDFOptions {
    fontSize: number;
    showBorders: boolean;
    scale: number; // 0.5 to 1.0 (50% to 100%)
}

export const DEFAULT_PDF_OPTIONS: PDFOptions = {
    fontSize: 7,
    showBorders: true,
    scale: 1.0
};

export function generateVectorPDF(year: number, months: MonthData[], options: PDFOptions = DEFAULT_PDF_OPTIONS): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false
    });

    // Calculate scaled dimensions - equal margins on all sides
    const scale = options.scale;
    const scaledContentWidth = (A4_WIDTH - (BASE_MARGIN * 2)) * scale;
    const scaledContentHeight = (A4_HEIGHT - (BASE_MARGIN * 2)) * scale;

    // Calculate uniform margins to center the content
    const marginX = (A4_WIDTH - scaledContentWidth) / 2;
    const marginY = (A4_HEIGHT - scaledContentHeight) / 2;

    // Scaled gap values
    const monthGapX = 3 * scale;
    const monthGapY = 4 * scale;
    const yearTitleSpace = 12 * scale;

    // Calculate month dimensions
    const monthWidth = (scaledContentWidth - (monthGapX * (COLS - 1))) / COLS;
    const monthHeight = (scaledContentHeight - yearTitleSpace - (monthGapY * (ROWS - 1))) / ROWS;

    // Set up fonts
    doc.setFont('helvetica', 'bold');

    // Draw year title (scaled)
    doc.setFontSize(16 * scale);
    doc.setTextColor(BLACK);
    doc.text(String(year), A4_WIDTH / 2, marginY + (6 * scale), { align: 'center' });

    const startY = marginY + yearTitleSpace;
    const weekdays = getWeekdayNames();

    // Draw each month
    months.forEach((monthData, index) => {
        const col = index % COLS;
        const row = Math.floor(index / COLS);

        const monthX = marginX + (col * (monthWidth + monthGapX));
        const monthY = startY + (row * (monthHeight + monthGapY));

        drawMonth(doc, monthData, monthX, monthY, monthWidth, monthHeight, weekdays, options, scale);
    });

    // Save the PDF
    doc.save(`Calendar-${year}.pdf`);
}

function drawMonth(
    doc: jsPDF,
    monthData: MonthData,
    x: number,
    y: number,
    width: number,
    height: number,
    weekdays: string[],
    options: PDFOptions,
    scale: number
): void {
    const cellWidth = width / 7;
    const headerHeight = 4 * scale;
    const weekdayHeight = 3 * scale;
    const daysStartY = y + headerHeight + weekdayHeight + (1 * scale);
    const availableHeightForDays = height - headerHeight - weekdayHeight - (2 * scale);
    const numWeeks = monthData.days.length;
    const cellHeight = availableHeightForDays / numWeeks;

    // Draw rounded rectangle border around month (if enabled)
    if (options.showBorders) {
        const borderRadius = 2 * scale;
        const padding = 1 * scale;
        doc.setDrawColor(BLACK);
        doc.setLineWidth(0.2 * scale);
        doc.roundedRect(x - padding, y - padding, width + (padding * 2), height + (padding * 2), borderRadius, borderRadius, 'S');
    }

    // Draw month name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7 * scale);
    doc.setTextColor(BLACK);
    doc.text(monthData.monthName, x + width / 2, y + (2.5 * scale), { align: 'center' });

    // Draw underline for month name
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.3 * scale);
    doc.line(x, y + headerHeight - (0.5 * scale), x + width, y + headerHeight - (0.5 * scale));

    // Draw weekday headers
    doc.setFontSize(5 * scale);
    doc.setFont('helvetica', 'bold');
    weekdays.forEach((day, i) => {
        const cellX = x + (i * cellWidth) + (cellWidth / 2);
        doc.text(day, cellX, y + headerHeight + (2.5 * scale), { align: 'center' });
    });

    // Draw days with configurable font size (also scaled)
    doc.setFontSize(options.fontSize * scale);
    monthData.days.forEach((week, weekIndex) => {
        week.forEach((day, dayIndex) => {
            const cellX = x + (dayIndex * cellWidth) + (cellWidth / 2);
            const cellY = daysStartY + (weekIndex * cellHeight) + (cellHeight / 2) + (1 * scale);

            // Set color and weight based on day type
            if (!day.isCurrentMonth) {
                doc.setTextColor(GRAY_LIGHT);
                doc.setFont('helvetica', 'normal');
            } else if (dayIndex === 0) {
                // Sunday - bold
                doc.setTextColor(BLACK);
                doc.setFont('helvetica', 'bold');
            } else {
                doc.setTextColor(BLACK);
                doc.setFont('helvetica', 'normal');
            }

            doc.text(String(day.date), cellX, cellY, { align: 'center' });
        });
    });
}
