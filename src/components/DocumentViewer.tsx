import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import "./styles.css"

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
  modified?: boolean; 
}

const PDFEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
 
  const pdfBytesRef = useRef<Uint8Array | null>(null);
  const [originalTextPositions, setOriginalTextPositions] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.error('No file selected');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Uploaded file is not a PDF');
      return;
    }
    console.log('Uploaded PDF file:', file.name, 'Size:', file.size);

    setIsLoading(true);
    setError(null);

    try {
      
      setTextItems([]);
      setPdfDimensions({ width: 0, height: 0 });
      pdfBytesRef.current = null;
      setOriginalPdfBytes(null);
      setOriginalTextPositions([]);
      
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);
      
     
      const bufferCopy = arrayBuffer.slice(0);
      const typedArray = new Uint8Array(bufferCopy);
      console.log('TypedArray created with length:', typedArray.length);
     
      let firstFiveBytes;
      try {
        firstFiveBytes = new TextDecoder().decode(typedArray.slice(0, 5));
        console.log('First 5 bytes:', firstFiveBytes);
      } catch (e) {
        console.error('Error decoding first bytes:', e);
        firstFiveBytes = '';
      }
      
      if (firstFiveBytes !== '%PDF-') {
        throw new Error('Invalid PDF format - missing PDF signature');
      }
      
      
      const finalCopy = new Uint8Array(typedArray.length);
      finalCopy.set(typedArray);
      
      pdfBytesRef.current = finalCopy;
      setOriginalPdfBytes(finalCopy);
      
      console.log('PDF bytes set, size:', finalCopy.length);
      console.log('pdfBytesRef value:', pdfBytesRef.current ? pdfBytesRef.current.length : 'null');

     
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
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
      console.log('Text content items:', textContent.items.length);
      
      
      const originalPositions = textContent.items.map((item: any, index: number) => ({
        index,
        transform: [...item.transform], 
        str: item.str
      }));
      
      
      originalPositions.sort((a: any, b: any) => {
        return b.transform[5] - a.transform[5];
      });
      
      setOriginalTextPositions(originalPositions);
      
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
          transform: [...transform],  
          pageHeight: viewport.height / scale,
          modified: false,
        };
      });

      const minY = Math.min(...items.map(item => item.y));
      const normalizedItems = items.map(item => ({
        ...item,
        y: item.y - minY,
      }));
      console.log('Normalized items:', normalizedItems.length);
      setTextItems(normalizedItems);
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
     
      pdfBytesRef.current = null;
      setOriginalPdfBytes(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (index: number, newText: string) => {
    setTextItems(prevItems =>
      prevItems.map((item, i) => 
        i === index 
          ? { ...item, str: newText, modified: true }
          : item
      )
    );
  };

  const handleTextFocus = (index: number) => {
    setSelectedIndex(index);  
  };

  const handleTextBlur = (index: number, e: React.FocusEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || '';
    if (textItems[index].str !== newText) {
      handleTextChange(index, newText);
    }
    setSelectedIndex(null);
  };

  const downloadModifiedPdf = async () => {
    console.log('Downloading modified PDF...');
   
    const pdfBytes = pdfBytesRef.current;
    
    if (!pdfBytes || pdfBytes.length === 0) {
      setError('No PDF data to modify');
      return;
    }
    
    const pdfBytesCopy = new Uint8Array(pdfBytes.length);
    try {
      pdfBytesCopy.set(pdfBytes);
      console.log('PDF bytes copied successfully, length:', pdfBytesCopy.length);
    } catch (e) {
      console.error('Error copying PDF bytes:', e);
      setError('Failed to process PDF: ArrayBuffer might be detached');
      return;
    }
    
    console.log('PDF bytes length:', pdfBytesCopy.length);
    
    let firstFiveBytes;
    try {
      firstFiveBytes = new TextDecoder().decode(pdfBytesCopy.slice(0, 5));
      console.log('First 5 bytes as text:', firstFiveBytes);
    } catch (e) {
      console.error('Error decoding first bytes:', e);
      setError('Failed to verify PDF: ArrayBuffer might be detached');
      return;
    }
    
    if (firstFiveBytes !== '%PDF-') {
      setError('Invalid PDF format - missing PDF signature');
      return;
    }
    
    setIsLoading(true);
    setError(null);
  
    try {
      console.log('Loading PDF document with valid bytes...');
      const pdfDoc = await PDFDocument.load(pdfBytesCopy);
      console.log('PDF document loaded successfully');
      
      const pages = pdfDoc.getPages();
      console.log('Number of pages:', pages.length);
      
      if (pages.length === 0) {
        throw new Error('PDF has no pages');
      }
      
      const firstPage = pages[0];
      const { width: pageWidth, height: pageHeight } = firstPage.getSize();
      console.log('Page dimensions:', pageWidth, 'x', pageHeight);
  
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      console.log('Font embedded');
      
      firstPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White
      });
  
      const updatedTextMap = textItems.reduce((map, item, index) => {
        map[index] = item.str;
        return map;
      }, {} as {[key: number]: string});
      
      console.log('Modified items:', textItems.filter(item => item.modified).length);
      
     
      for (const origItem of originalTextPositions) {
        const index = origItem.index;
        const originalText = origItem.str;
        const currentText = updatedTextMap[index] || originalText;
       
        const origTransform = origItem.transform;
        const x = origTransform[4];
       
        const y = origTransform[5];
        
        
        const fontSize = Math.abs(origTransform[3]);
        
        console.log(`Drawing text "${currentText}" at ${x}, ${y} (original position)`);
  
        firstPage.drawText(currentText, {
          x: x,
          y: y,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
  
      console.log('Saving modified PDF...');
      const modifiedPdfBytes = await pdfDoc.save();
      console.log('Modified PDF size:', modifiedPdfBytes.length);
      downloadBlob(modifiedPdfBytes, 'modified-document.pdf');
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      setError(`Failed to generate PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadPdf = () => {
   
    const pdfBytes = pdfBytesRef.current;
    
    if (!pdfBytes || pdfBytes.length === 0) {
      setError('No PDF data to download');
      return;
    }
    
    let pdfBytesCopy;
    try {
      pdfBytesCopy = new Uint8Array(pdfBytes.length);
      pdfBytesCopy.set(pdfBytes);
      console.log('Downloading original PDF, size:', pdfBytesCopy.length);
    } catch (e) {
      console.error('Error copying PDF bytes for download:', e);
      setError('Failed to download PDF: ArrayBuffer might be detached');
      return;
    }
    
    let firstFiveBytes;
    try {
      firstFiveBytes = new TextDecoder().decode(pdfBytesCopy.slice(0, 5));
      console.log('First 5 bytes for download:', firstFiveBytes);
    } catch (e) {
      console.error('Error verifying PDF bytes for download:', e);
      setError('Failed to verify PDF for download: ArrayBuffer might be detached');
      return;
    }
  
    if (firstFiveBytes !== '%PDF-') {
      setError('Invalid PDF format for download - missing PDF signature');
      return;
    }
    
    const blob = new Blob([pdfBytesCopy], { type: 'application/pdf' });
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
    <div className="pdf-editor-container">
      <h2 className="pdf-editor-title">Editable PDF Viewer</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        className="pdf-file-upload"
        disabled={isLoading}
      />

      {error && (
        <div className="pdf-error-message">
          {error}
        </div>
      )}

      <div className="pdf-button-container">
        <button
          onClick={downloadModifiedPdf}
          disabled={!pdfBytesRef.current || isLoading || textItems.length === 0}
          className={`pdf-button pdf-button-success ${isLoading ? 'pdf-button-loading' : ''}`}
        >
          {isLoading ? 'Processing...' : 'Download Modified PDF'}
        </button>

        <button 
          onClick={handleDownloadPdf} 
          disabled={!pdfBytesRef.current}
          className="pdf-button pdf-button-primary"
        >
          Download Original PDF
        </button>
        
        {textItems.filter(item => item.modified).length > 0 && (
          <div className="pdf-modified-indicator">
            {textItems.filter(item => item.modified).length} text items modified
          </div>
        )}
      </div>

      {isLoading && <div className="pdf-loading">Loading PDF...</div>}

      <div
        className="pdf-viewer-container"
        style={{
          width: `${pdfDimensions.width}px`,
          height: `${pdfDimensions.height}px`,
          display: pdfBytesRef.current ? 'block' : 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          className="pdf-canvas"
        />

        {textItems.map((item, index) => (
          <div
            key={index}
            contentEditable
            suppressContentEditableWarning
            className={`
              pdf-editable-text 
              ${selectedIndex === index ? 'pdf-editable-text-selected' : ''}
              ${item.modified ? 'pdf-editable-text-modified' : ''}
            `}
            style={{
              top: `${item.y}px`,
              left: `${item.x}px`,
              fontSize: `${item.fontSize}px`,
              minWidth: `${item.width}px`,
              minHeight: `${item.height}px`,
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