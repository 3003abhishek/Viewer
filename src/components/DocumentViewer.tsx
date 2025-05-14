import React, { useRef, useState, useEffect } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker path properly
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  height: number;
  originalX: number;
  originalY: number;
  transform: number[];
  pageHeight: number;
}

const PDFEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      setOriginalPdfBytes(typedArray);

      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      const scale = 1.5;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });

      setPdfDimensions({
        width: viewport.width,
        height: viewport.height,
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;

      const textContent = await page.getTextContent();
      const items: TextItem[] = textContent.items.map((item: any) => {
        const transform = item.transform;
        const x = transform[4] * scale;
        const y = viewport.height - (transform[5] * scale) - (item.height * scale);
        const fontSize = Math.abs(transform[3]) * scale;

        return {
          str: item.str,
          x,
          y,
          fontSize,
          width: item.width * scale,
          height: item.height * scale,
          originalX: transform[4],
          originalY: transform[5],
          transform: item.transform,
          pageHeight: viewport.height / scale,
        };
      });

      const minY = Math.min(...items.map(item => item.y));
      const normalizedItems = items.map(item => ({
        ...item,
        y: item.y - minY,
      }));

      setTextItems(normalizedItems);
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError('Failed to load PDF. Please try another file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (index: number, newText: string) => {
    setTextItems(prevItems =>
      prevItems.map((item, i) => (i === index ? { ...item, str: newText } : item))
    );
  };

  const handleTextFocus = (index: number) => {
    setSelectedIndex(index);
  };

  const handleTextBlur = (index: number, e: React.FocusEvent<HTMLDivElement>) => {
    handleTextChange(index, e.currentTarget.textContent || '');
    setSelectedIndex(null);
  };

  const downloadModifiedPdf = async () => {
    if (!originalPdfBytes) {
      setError('No PDF loaded');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Add modified text
      for (const item of textItems) {
        try {
          // Convert coordinates properly
          const yPos = item.pageHeight - item.originalY - (item.height / 1.5);
          
          firstPage.drawText(item.str, {
            x: item.originalX,
            y: yPos,
            size: item.fontSize / 1.5,
            color: rgb(0, 0, 0),
          });
        } catch (err) {
          console.error('Error drawing text:', err);
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      downloadBlob(modifiedPdfBytes, 'modified-document.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBlob = (data: Uint8Array, fileName: string) => {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Editable PDF Viewer</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        style={{ marginBottom: '20px' }}
        disabled={isLoading}
      />

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <button
        onClick={downloadModifiedPdf}
        disabled={!originalPdfBytes || isLoading}
        style={{
          marginBottom: '20px',
          padding: '8px 16px',
          backgroundColor: originalPdfBytes ? '#4CAF50' : '#cccccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: originalPdfBytes ? 'pointer' : 'not-allowed',
        }}
      >
        {isLoading ? 'Processing...' : 'Download Modified PDF'}
      </button>

      {isLoading && <div>Loading PDF...</div>}

      <div
        style={{
          position: 'relative',
          margin: '0 auto',
          width: `${pdfDimensions.width}px`,
          height: `${pdfDimensions.height}px`,
          border: '1px solid #ddd',
          backgroundColor: '#f9f9f9',
          display: originalPdfBytes ? 'block' : 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            width: 0,
            height: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />

        {textItems.map((item, index) => (
          <div
            key={index}
            contentEditable
            suppressContentEditableWarning
            style={{
              position: 'absolute',
              top: `${item.y}px`,
              left: `${item.x}px`,
              fontSize: `${item.fontSize}px`,
              fontFamily: 'sans-serif',
              color: '#000',
              whiteSpace: 'pre',
              lineHeight: 1,
              minWidth: `${item.width}px`,
              minHeight: `${item.height}px`,
              padding: '2px',
              outline: 'none',
              backgroundColor: selectedIndex === index ? 'rgba(255,255,0,0.3)' : 'transparent',
              border: selectedIndex === index ? '1px dashed #0066ff' : 'none',
              cursor: 'text',
            }}
            onFocus={() => handleTextFocus(index)}
            onBlur={(e) => handleTextBlur(index, e)}
            dangerouslySetInnerHTML={{ __html: item.str }}
          />
        ))}
      </div>
    </div>
  );
};

export default PDFEditor;