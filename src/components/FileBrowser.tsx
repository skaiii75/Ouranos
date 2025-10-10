import { html } from 'htm/preact';
import type { R2Object } from '../utils/r2';
import { formatBytes } from '../utils/formatters';

const UploadIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
const ImageFileIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
const VideoFileIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
const GenericFileIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
const AlertIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
const CheckIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const FolderIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const TrashIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const CopyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

interface FileBrowserProps {
  objects: R2Object[];
  folders: string[];
  isLoading: boolean;
  error: string | null;
  publicDomain: string | null;
  onUploadClick: () => void;
  onObjectClick: (object: R2Object) => void;
  onFolderClick: (folderPrefix: string) => void;
  
  // Selection props
  isSelectionMode: boolean;
  toggleSelectionMode: () => void;
  selectedItems: Set<string>;
  onSelectItem: (key: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onCopyUrlsSelected: () => void;
  copyUrlSuccess: boolean;
}

export const FileBrowser = (props: FileBrowserProps) => {
    const { 
        objects, folders, isLoading, error, publicDomain, onUploadClick, onObjectClick, onFolderClick,
        isSelectionMode, toggleSelectionMode, selectedItems, onSelectItem, onSelectAll,
        onDeleteSelected, onCopyUrlsSelected, copyUrlSuccess
    } = props;

    const renderFolderItem = (folderPrefix: string) => {
        const folderName = folderPrefix.split('/').slice(-2, -1)[0];
        const isSelected = selectedItems.has(folderPrefix);

        const handleClick = () => {
            if (isSelectionMode) {
                onSelectItem(folderPrefix);
            } else {
                onFolderClick(folderPrefix);
            }
        };

        return html`
            <div class="file-browser-item folder-item ${isSelected ? 'selected' : ''}" key=${folderPrefix} onClick=${handleClick}>
                ${isSelectionMode && html`
                    <div class="selection-checkbox"><${CheckIcon} /></div>
                `}
                <div class="file-browser-thumbnail">
                    <div class="file-browser-thumbnail-icon"><${FolderIcon} /></div>
                </div>
                <div class="file-browser-item-info">
                    <span class="file-browser-item-name" title=${folderName}>${folderName}</span>
                    <span class="file-browser-item-size">Folder</span>
                </div>
            </div>
        `;
    };

    const renderFileItem = (object: R2Object) => {
        const fileName = object.key.split('/').pop() || object.key;
        const isSelected = selectedItems.has(object.key);
        const isImage = object.httpMetadata?.contentType?.startsWith('image/');
        const isVideo = object.httpMetadata?.contentType?.startsWith('video/');
        const thumbnailUrl = publicDomain ? `https://${publicDomain.replace(/\/$/, '')}/${object.key}` : null;
        
        const handleClick = () => {
             if (isSelectionMode) {
                onSelectItem(object.key);
            } else {
                onObjectClick(object);
            }
        };

        let thumbnailContent;
        if (thumbnailUrl) {
            if (isImage) thumbnailContent = html`<img src=${thumbnailUrl} alt=${fileName} loading="lazy" />`;
            else if (isVideo) thumbnailContent = html`<video src=${`${thumbnailUrl}#t=0.5`} preload="metadata" muted />`;
            else thumbnailContent = html`<div class="file-browser-thumbnail-icon"><${GenericFileIcon} /></div>`;
        } else {
            if (isImage) thumbnailContent = html`<div class="file-browser-thumbnail-icon"><${ImageFileIcon} /></div>`;
            else if (isVideo) thumbnailContent = html`<div class="file-browser-thumbnail-icon"><${VideoFileIcon} /></div>`;
            else thumbnailContent = html`<div class="file-browser-thumbnail-icon"><${GenericFileIcon} /></div>`;
        }

        return html`
            <div class="file-browser-item ${isSelected ? 'selected' : ''}" key=${object.key} onClick=${handleClick}>
                ${isSelectionMode && html`
                    <div class="selection-checkbox"><${CheckIcon} /></div>
                `}
                <div class="file-browser-thumbnail">
                    ${thumbnailContent}
                </div>
                <div class="file-browser-item-info">
                    <span class="file-browser-item-name" title=${fileName}>${fileName}</span>
                    <span class="file-browser-item-size">${formatBytes(object.size)}</span>
                </div>
            </div>
        `;
    };
    
    const renderContent = () => {
        if (isLoading) {
            return html`<div style="display: flex; justify-content: center; padding: 2rem;"><div class="loader"></div></div>`;
        }
        if (error) {
            return html`<div class="alert alert-danger">${error}</div>`;
        }
        if (objects.length === 0 && folders.length === 0) {
            return html`<div class="no-projects"><p>This folder is empty.</p><p>Click the button above to start uploading files.</p></div>`;
        }
        return html`
            <div class="file-browser-grid">
                ${folders.map(renderFolderItem)}
                ${objects.map(renderFileItem)}
            </div>
        `;
    };
    
    const allItemsCount = folders.length + objects.length;
    const allSelected = selectedItems.size === allItemsCount && allItemsCount > 0;

    return html`
        <div class="file-browser-container">
            <div class="file-browser-header">
                ${!isSelectionMode ? html`
                    <button class="btn btn-primary" onClick=${onUploadClick}>
                        <${UploadIcon} />
                        <span>Upload</span>
                    </button>
                    <button class="btn btn-secondary" onClick=${toggleSelectionMode} disabled=${allItemsCount === 0}>
                        Select
                    </button>
                ` : html`
                    <div class="file-browser-header-actions">
                        <span class="selection-info">${selectedItems.size} / ${allItemsCount} selected</span>
                        <button class="btn btn-secondary" onClick=${onSelectAll}>
                           ${allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                     <div class="file-browser-header-actions">
                        <button class="btn btn-secondary" onClick=${onCopyUrlsSelected} disabled=${selectedItems.size === 0}>
                            ${copyUrlSuccess ? '✓ Copied' : html`<${CopyIcon} /> Copy URLs`}
                        </button>
                        <button class="btn btn-secondary" onClick=${onDeleteSelected} disabled=${selectedItems.size === 0}>
                            <${TrashIcon} /> Delete
                        </button>
                        <button class="btn btn-primary" onClick=${toggleSelectionMode}>Done</button>
                    </div>
                `}
            </div>
            
            ${!publicDomain && objects.length > 0 && html`
                <div class="alert alert-info" style="display: flex; gap: 1rem; align-items: center;">
                    <${AlertIcon} />
                    <span>To display thumbnails, configure the public domain for this bucket in the settings (on the bucket selection screen).</span>
                </div>
            `}
            
            ${renderContent()}
        </div>
    `;
};