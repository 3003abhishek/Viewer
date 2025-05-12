import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import "./styles.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const PDFEditor = () => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const textLayerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0 && acceptedFiles[0].type === 'application/pdf') {
        setFile(acceptedFiles[0]);
        setEditing(false);
        setCurrentPage(1);
      }
    }, []),
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const enableEditing = () => {
    setEditing(true);
    // Add editing capabilities to all text elements
    setTimeout(() => {
      const textLayer = document.querySelector('.pdf-page.editing-mode .textLayer');
      if (textLayer) {
        const textSpans = textLayer.querySelectorAll('span');
        textSpans.forEach(span => {
          span.setAttribute('contenteditable', 'true');
          span.classList.add('editable-text');
        });
  
        if (textSpans.length > 0) {
          (textSpans[0] as HTMLElement).focus();
        }
      }
    }, 300);
  };
  

  const disableEditing = () => {
    setEditing(false);
    const textLayer = document.querySelector('.pdf-page .textLayer');
    if (textLayer) {
      const textSpans = textLayer.querySelectorAll('span');
      textSpans.forEach(span => {
        span.removeAttribute('contenteditable');
        span.classList.remove('editable-text');
      });
    }
  };
  

  const saveChanges = () => {
    disableEditing();
    console.log("Changes saved - implement PDF modification here");
  };

  useEffect(() => {
    // Clean up editing when changing pages
    if (editing) {
      disableEditing();
      setTimeout(enableEditing, 300);
    }
  }, [currentPage]);

  // Handle clicks on text elements to ensure proper focus
  useEffect(() => {
    const handleTextClick = (e: MouseEvent) => {
      if (editing && e.target instanceof HTMLElement && e.target.classList.contains('editable-text')) {
        e.preventDefault();
        e.target.focus();
      }
    };

    document.addEventListener('click', handleTextClick);
    return () => document.removeEventListener('click', handleTextClick);
  }, [editing]);

  return (
    <div className="pdf-editor-container">
      {!file ? (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <p>Drag & drop a PDF here, or click to select</p>
        </div>
      ) : (
        <div className="editor-wrapper">
          <div className="toolbar">
            <button onClick={() => setFile(null)}>Close</button>
            {!editing ? (
              <button onClick={enableEditing}>Edit PDF</button>
            ) : (
              <button onClick={saveChanges}>Save Changes</button>
            )}
            <div className="zoom-controls">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
              <span>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))}>+</button>
            </div>
            <div className="page-controls">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {numPages || 1}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                disabled={currentPage >= (numPages || 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="document-area">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="loading">Loading PDF...</div>}
            >
              <Page
                pageNumber={currentPage}
                width={800 * scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                inputRef={(ref) => pageRefs.current[currentPage] = ref}
                className={`pdf-page ${editing ? 'editing-mode' : ''}`}
              >
                {/* <div 
                  className="textLayer" 
                  ref={(ref) => textLayerRefs.current[currentPage] = ref}
                /> */}
              </Page>
            </Document>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFEditor;