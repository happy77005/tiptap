import { useState, useRef } from 'react';
import { Download, Loader2, Settings, Plus, Minus, Square, CheckSquare } from 'lucide-react';
import CalendarView from './components/CalendarView';
import { generateYearCalendar } from './utils/calendar';
import { generateVectorPDF, PDFOptions, DEFAULT_PDF_OPTIONS } from './utils/pdfGenerator';

function App() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PDFOptions>(DEFAULT_PDF_OPTIONS);
  const calendarRef = useRef<HTMLDivElement>(null);

  const months = generateYearCalendar(year);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newYear = parseInt(e.target.value);
    if (!isNaN(newYear) && newYear >= 1900 && newYear <= 2100) {
      setYear(newYear);
    }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      generateVectorPDF(year, months, pdfOptions);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const adjustFontSize = (delta: number) => {
    setPdfOptions(prev => ({
      ...prev,
      fontSize: Math.max(4, Math.min(50, prev.fontSize + delta))
    }));
  };

  const toggleBorders = () => {
    setPdfOptions(prev => ({
      ...prev,
      showBorders: !prev.showBorders
    }));
  };

  const adjustScale = (delta: number) => {
    setPdfOptions(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(1.0, Math.round((prev.scale + delta) * 100) / 100))
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="controls-bar">
        <div className="controls-container">
          <div className="year-input-group">
            <label htmlFor="year-input" className="year-label">
              Year:
            </label>
            <input
              id="year-input"
              type="number"
              value={year}
              onChange={handleYearChange}
              min="1900"
              max="2100"
              className="year-input"
            />
          </div>

          <div className="export-controls">
            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`settings-button ${showAdvanced ? 'active' : ''}`}
              title="Advanced Options"
            >
              <Settings size={20} />
            </button>

            {/* Advanced Options Panel */}
            {showAdvanced && (
              <div className="advanced-options">
                {/* Font Size Control */}
                <div className="option-group">
                  <span className="option-label">Size:</span>
                  <button
                    onClick={() => adjustFontSize(-1)}
                    className="option-button"
                    title="Decrease font size"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="option-value">{pdfOptions.fontSize}</span>
                  <button
                    onClick={() => adjustFontSize(1)}
                    className="option-button"
                    title="Increase font size"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Border Toggle */}
                <button
                  onClick={toggleBorders}
                  className={`border-toggle ${pdfOptions.showBorders ? 'active' : ''}`}
                  title={pdfOptions.showBorders ? 'Hide borders' : 'Show borders'}
                >
                  {pdfOptions.showBorders ? <CheckSquare size={18} /> : <Square size={18} />}
                  <span>Borders</span>
                </button>

                {/* Scale Control */}
                <div className="option-group">
                  <span className="option-label">Scale:</span>
                  <button
                    onClick={() => adjustScale(-0.05)}
                    className="option-button"
                    title="Decrease scale"
                    disabled={pdfOptions.scale <= 0.5}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="option-value">{Math.round(pdfOptions.scale * 100)}%</span>
                  <button
                    onClick={() => adjustScale(0.05)}
                    className="option-button"
                    title="Increase scale"
                    disabled={pdfOptions.scale >= 1.0}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Download Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="export-button"
            >
              {isExporting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download size={20} />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        <CalendarView ref={calendarRef} year={year} months={months} />
      </div>
    </div>
  );
}

export default App;
