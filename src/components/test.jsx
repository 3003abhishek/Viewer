import React, { useRef, useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  const refPdf = useRef<Uint8Array | null>(null);


  useEffect(() => {
    console.log('originalPdfBytes updatediiiiiiiiiiing:', originalPdfBytes);
    if (originalPdfBytes) {
      console.log('originalPdfBytes updated:', originalPdfBytes);
    }
  }, [originalPdfBytes]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.error('No file selected');
      return;
    }
    if (file.type !== 'application/pdf') {
      console.error('Uploaded file is not a PDF');
      return;
    }
    console.log('Uploaded PDF file:', file.name, 'Size:', file.size);

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      setOriginalPdfBytes(typedArray);
      refPdf.current = typedArray;
      console.log('PDF bytes set, size:', typedArray.length);
      console.log('originalPdfBytes:', originalPdfBytes);

      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      // console.log('PDF loaded:', pdf);
      // const pdf = await pdfjsLib.getDocument(typedArray).promise;
      console.log('PDF loaded:', pdf);

      const scale = 1.5;
      const page = await pdf.getPage(1);
      console.log('Page loaded:', page);
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
      console.log(textContent)
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
      console.log('Normalized items:', normalizedItems);
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

  const downloadModifiedPdf = async (pdfBytes: Uint8Array) => {
    console.log('Downloading modified PDF...');
    setIsLoading(true);
    setError(null);
  
    try {
      console.log('Loading PDF document...', textItems);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      // console.log('PDF document loaded:', pdfDoc);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width: pageWidth, height: pageHeight } = firstPage.getSize();
  
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
      // Clear the page content (optional, not fully supported in pdf-lib)
      // Instead, just overlay text
  
      for (const item of textItems) {
        const yPos = pageHeight - item.originalY - (item.fontSize / 1.5); // Adjusted position
  
        firstPage.drawText(item.str, {
          x: item.originalX,
          y: yPos,
          size: item.fontSize / 1.5,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
  
      const modifiedPdfBytes = await pdfDoc.save();
      downloadBlob(modifiedPdfBytes, 'modified-document.pdf');
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      setError(`Failed to generate PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadPdf = () => {
    if (!originalPdfBytes) {
      console.error('No PDF data to download');
      return;
    }
  
    const blob = new Blob([originalPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'downloaded.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const downloadBlob = (data: Uint8Array, fileName: string) => {
    try {
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
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to create download link');
    }
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => originalPdfBytes && downloadModifiedPdf(originalPdfBytes)}
          disabled={!originalPdfBytes || isLoading || textItems.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: originalPdfBytes && textItems.length > 0 ? '#4CAF50' : '#cccccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: originalPdfBytes && textItems.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'Processing...' : 'Download Modified PDF'}
        </button>

        <button 
          onClick={handleDownloadPdf} 
          disabled={!originalPdfBytes}
          style={{
            padding: '8px 16px',
            backgroundColor: originalPdfBytes ? '#2196F3' : '#cccccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: originalPdfBytes ? 'pointer' : 'not-allowed',
          }}
        >
          Download Original PDF
        </button>
      </div>

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