import { html } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';

interface FileDropzoneProps {
  onFilesSelect: (files: File[]) => void;
}

const UploadIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
`;
const FilesIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"/><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"/><path d="M15 2v5h5"/></svg>`;
const FolderIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"></path></svg>`;

export const FileDropzone = ({ onFilesSelect }: FileDropzoneProps) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      onFilesSelect(Array.from(droppedFiles));
    }
  };

  const handleFileChange = (e: Event) => {
    const selectedFiles = (e.target as HTMLInputElement).files;
    if (selectedFiles && selectedFiles.length > 0) {
      onFilesSelect(Array.from(selectedFiles));
    }
     // Reset the input value to allow selecting the same file(s) again
    (e.target as HTMLInputElement).value = '';
  };

  return html`
    <div class="file-dropzone-container">
        <label for="single-file-input" class="drop-zone ${isDragging ? 'drag-over' : ''}" onDragOver=${handleDragOver} onDragLeave=${handleDragLeave} onDrop=${handleDrop}>
          <div class="drop-zone-icon"><${UploadIcon} /></div>
          <p><strong>Drag and drop</strong> a file, multiple files, or even a folder</p>
          <p class="light-text">Or use the options below</p>
          <input type="file" id="single-file-input" onChange=${handleFileChange} accept="image/*,video/*" style="display:none" />
        </label>
        
        <div class="file-selector-actions">
            <button class="btn btn-secondary" onClick=${() => fileInputRef.current?.click()}>
                <${FilesIcon} />
                <span>Choose Files</span>
            </button>
            <input ref=${fileInputRef} type="file" onChange=${handleFileChange} accept="image/*,video/*" multiple style="display:none" />
            
            <button class="btn btn-secondary" onClick=${() => folderInputRef.current?.click()}>
                <${FolderIcon} />
                <span>Choose a Folder</span>
            </button>
            <input ref=${folderInputRef} type="file" onChange=${handleFileChange} webkitdirectory directory multiple style="display:none" />
        </div>
    </div>
  `;
};