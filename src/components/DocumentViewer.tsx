
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, Page } from 'react-pdf';
import "./styles.css"

import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';


pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const DocumentViewer = () => {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState<string|null>(null);
  const [numPages, setNumPages] = useState(null);
  const [editing, setEditing] = useState(false);

  const onDrop = useCallback((acceptedFiles:any) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      determineFileType(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    multiple: false,
  });

  const determineFileType = (file:any) => {
    const extension = file.name.split('.').pop().toLowerCase();
    const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    
    if (extension === 'pdf') {
      setFileType('pdf');
    } else if (officeTypes.includes(extension)) {
      setFileType('office');
    } else {
      setFileType('unsupported');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }:any) => {
    setNumPages(numPages);
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
  };

  return (
    <div className="document-viewer-container">
      {!file ? (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <p>Drag & drop a document here, or click to select</p>
          <p>Supports: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX</p>
        </div>
      ) : (
        <div className="viewer-wrapper">
          <div className="toolbar">
            <button onClick={() => setFile(null)}>Close</button>
            {fileType === 'pdf' && <button onClick={handleEdit} disabled={editing}>Edit</button>}
            {editing && <button onClick={handleSave}>Save</button>}
          </div>
          
          <div className="document-container">
            {fileType === 'pdf' && (
              <div className="pdf-viewer">
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      width={800}
                    />
                  ))}
                </Document>
              </div>
            )}
            
            {fileType === 'office' && (
              <div className="office-viewer">
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(URL.createObjectURL(file))}`}
                  width="100%"
                  height="600px"
                  frameBorder="0"
                  title="Office Document Viewer"
                ></iframe>
              </div>
            )}
            
            {fileType === 'unsupported' && (
              <div className="unsupported-message">
                <p>This file type is not supported.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;