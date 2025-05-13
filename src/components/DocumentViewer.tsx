import { useEffect, useRef, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  id: string;
}

const CanvasPDFEditor = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);


  const fontOptions = [
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times-Roman', label: 'Times New Roman' },
    { value: 'Courier', label: 'Courier' },
  ];


  const colorOptions = [
    { value: '#000000', label: 'Black' },
    { value: '#FF0000', label: 'Red' },
    { value: '#0000FF', label: 'Blue' },
    { value: '#008000', label: 'Green' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (canvas && overlay) {
      overlay.style.width = `${canvas.width}px`;
      overlay.style.height = `${canvas.height}px`;
    }
  }, [scale, currentPage, pdfData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const buffer = await file.arrayBuffer();
      setPdfData(buffer);
      setCurrentPage(1);
      setTextItems([]);
      setSelectedItem(null);
    }
  };

  const loadPage = async (pageNumber: number) => {
    if (!pdfData) return;

    try {
      const loadingTask = getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      setTotalPages(pdf.numPages);

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };
  useEffect(() => {
    loadPage(currentPage);
  }, [pdfData, currentPage, scale]);

  const handleInputChange = (id: string, value: string) => {
    setTextItems(current =>
      current.map(item =>
        item.id === id ? { ...item, str: value } : item
      )
    );
  };

  const handleStyleChange = (id: string, property: keyof TextItem, value: any) => {
    setTextItems(current =>
      current.map(item =>
        item.id === id ? { ...item, [property]: value } : item
      )
    );
  };

  const handleDragStart = (e: React.MouseEvent<HTMLInputElement>, id: string) => {
    const input = e.currentTarget;
    e.preventDefault();
    setSelectedItem(id);

    const startX = e.clientX;
    const startY = e.clientY;

    const origLeft = parseFloat(input.style.left);
    const origTop = parseFloat(input.style.top);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      input.style.left = `${origLeft + dx}px`;
      input.style.top = `${origTop + dy}px`;

      setTextItems(current =>
        current.map(item =>
          item.id === id ? { ...item, x: origLeft + dx, y: origTop + dy } : item
        )
      );
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const addNewText = () => {
    const newText: TextItem = {
      str: 'New Text',
      x: 50,
      y: 50,
      fontSize: 12,
      color: '#000000',
      fontFamily: 'Helvetica',
      id: Math.random().toString(36).substring(2, 9)
    };
    setTextItems([...textItems, newText]);
    setSelectedItem(newText.id);
  };

  const deleteSelectedText = () => {
    if (!selectedItem) return;
    setTextItems(textItems.filter(item => item.id !== selectedItem));
    setSelectedItem(null);
  };

  const saveEditedPDF = async () => {
    if (!pdfData || !canvasRef.current) return;

    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      const [page] = pdfDoc.getPages();

      const fontCache: Record<string, any> = {};
      for (const fontName of [...new Set(textItems.map(item => item.fontFamily))]) {
        if (fontName === 'Helvetica') {
          fontCache[fontName] = await pdfDoc.embedFont(StandardFonts.Helvetica);
        } else if (fontName === 'Times-Roman') {
          fontCache[fontName] = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        } else if (fontName === 'Courier') {
          fontCache[fontName] = await pdfDoc.embedFont(StandardFonts.Courier);
        }
      }

      textItems.forEach(item => {
        const y = canvasRef.current!.height - item.y;
        const color = hexToRgb(item.color || '#000000');

        page.drawText(item.str, {
          x: item.x,
          y,
          size: item.fontSize || 12,
          font: fontCache[item.fontFamily || 'Helvetica'],
          color: rgb(color.r / 255, color.g / 255, color.b / 255),
        });
      });

      const pdfBytes = await pdfDoc.save();
      downloadPDF(pdfBytes, 'edited.pdf');
    } catch (error) {
      console.error('Error saving PDF:', error);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedItemData = textItems.find(item => item.id === selectedItem);

  return (
    <div style={{ maxWidth: 1000, margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
      <h2>PDF Editor</h2>

      {/* Top controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />

        {pdfFile && (
          <>
            <button onClick={addNewText} style={buttonStyle}>
              Add Text
            </button>

            <button
              onClick={deleteSelectedText}
              disabled={!selectedItem}
              style={{ ...buttonStyle, opacity: selectedItem ? 1 : 0.5 }}
            >
              Delete Selected
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label>Zoom:</label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                style={selectStyle}
              >
                <option value={0.5}>50%</option>
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
              </select>
            </div>

            <button onClick={saveEditedPDF} style={{ ...buttonStyle, backgroundColor: '#28a745' }}>
              Save Edited PDF
            </button>
          </>
        )}
      </div>


      {totalPages > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ ...buttonStyle, padding: '0.25rem 0.5rem' }}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ ...buttonStyle, padding: '0.25rem 0.5rem' }}
          >
            Next
          </button>
        </div>
      )}


      <div style={{ display: 'flex', gap: '1rem' }}>

        <div style={{ position: 'relative', marginTop: '1rem', userSelect: 'none', flex: 1 }}>
          <canvas
            ref={canvasRef}
            style={{ border: '1px solid #ccc', display: 'block', maxWidth: '100%' }}
          />
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {textItems.map((item) => (
              <input
                key={item.id}
                value={item.str}
                onChange={(e) => handleInputChange(item.id, e.target.value)}
                onMouseDown={(e) => {

                  if (e.target === e.currentTarget) {
                    handleDragStart(e, item.id);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item.id);
                  e.currentTarget.focus(); // Focus the input when clicked
                }}
                style={{
                  position: 'absolute',
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  minWidth: '50px',
                  width: `${Math.max(item.str.length * (item.fontSize || 12) * 0.6, 50)}px`,
                  fontSize: `${item.fontSize}px`,
                  padding: '2px 4px',
                  border: `2px solid ${item.id === selectedItem ? '#ff0000' : '#007bff'}`,
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: item.color,
                  fontFamily: item.fontFamily === 'Times-Roman' ? 'Times New Roman' : item.fontFamily,
                  cursor: 'move',
                  boxSizing: 'border-box',
                  outline: 'none',
                  userSelect: 'text', // Allow text selection
                }}
              />
            ))}
          </div>
        </div>

        {/* Text properties panel */}
        {selectedItemData && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <div>
              <label>Font:</label>
              <select
                value={selectedItemData.fontFamily}
                onChange={(e) => handleStyleChange(selectedItemData.id, 'fontFamily', e.target.value)}
              >
                {fontOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Color:</label>
              <select
                value={selectedItemData.color}
                onChange={(e) => handleStyleChange(selectedItemData.id, 'color', e.target.value)}
              >
                {colorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Font Size:</label>
              <input
                type="number"
                value={selectedItemData.fontSize}
                min={8}
                max={72}
                onChange={(e) =>
                  handleStyleChange(selectedItemData.id, 'fontSize', parseInt(e.target.value))
                }
                style={{ width: '60px' }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Reusable style objects
const buttonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
};

const selectStyle = {
  padding: '0.25rem',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '14px',
};

const inputStyle = {
  padding: '0.25rem',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '14px',
  width: '100%',
};

export default CanvasPDFEditor;