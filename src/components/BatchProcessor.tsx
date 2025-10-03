
import { html } from 'htm/preact';
import { useMemo, useRef } from 'preact/hooks';
import { VNode } from 'preact';
import { CompressionOptions } from './CompressionOptions';
import { formatBytes } from '../utils/formatters';
import type { BatchFileStatus } from '../App';

interface BatchFile {
    file: File;
    id: string;
}

interface BatchProcessorProps {
    files: BatchFile[];
    progress: { [id: string]: BatchFileStatus };
    imageOptions: { format: string; quality: number };
    setImageOptions: (options: { format: string; quality: number }) => void;
    videoOptions: { format: string; quality: number; };
    setVideoOptions: (options: { format: string; quality: number; }) => void;
    onStartProcess: () => void;
    isProcessing: boolean;
    onClear: () => void;
    onAddFiles: (files: File[]) => void;
    onRemoveFile: (id: string) => void;
}

const ImageFileIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
const VideoFileIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
const FilesIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"/><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"/><path d="M15 2v5h5"/></svg>`;
const FolderIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"></path></svg>`;
const TrashIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

const FileStatus = ({ statusInfo }: { statusInfo: BatchFileStatus }) => {
    const { status, message } = statusInfo;
    
    if (status === 'pending') {
        return html`<div class="file-status file-status-pending">En attente</div>`;
    }
    if (status === 'compressing' || status === 'uploading') {
        return html`<div class="file-status file-status-processing"><div class="loader"></div> ${status === 'compressing' ? 'Compression' : 'Envoi...'}</div>`;
    }
    if (status === 'success') {
        return html`<div class="file-status file-status-success">✓ Succès</div>`;
    }
    if (status === 'error') {
        return html`
            <div class="file-status file-status-error file-item-error-tooltip">
                ✗ Erreur
                ${message && html`<span class="tooltip-text">${message}</span>`}
            </div>
        `;
    }
    return null;
};

export const BatchProcessor = ({
    files,
    progress,
    imageOptions,
    setImageOptions,
    videoOptions,
    setVideoOptions,
    onStartProcess,
    isProcessing,
    onClear,
    onAddFiles,
    onRemoveFile,
}: BatchProcessorProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const { imageFiles, videoFiles } = useMemo(() => {
        const images = files.filter(f => f.file.type.startsWith('image/'));
        const videos = files.filter(f => f.file.type.startsWith('video/'));
        return { imageFiles: images, videoFiles: videos };
    }, [files]);

    const totalOriginalSize = useMemo(() => files.reduce((acc, f) => acc + f.file.size, 0), [files]);
    const totalCompressedSize = useMemo(() => Object.values(progress).reduce((acc, p) => acc + (p.compressedSize || 0), 0), [progress]);

    const handleFileChange = (e: Event) => {
        const selectedFiles = (e.target as HTMLInputElement).files;
        if (selectedFiles && selectedFiles.length > 0) {
          onAddFiles(Array.from(selectedFiles));
        }
        (e.target as HTMLInputElement).value = ''; // Reset for same file selection
    };

    return html`
        <div class="batch-processor-container">
            <div class="batch-summary">
                <h2>Traitement par lot</h2>
                <p class="light-text">
                    ${imageFiles.length} image(s) et ${videoFiles.length} vidéo(s) à traiter.
                    Taille totale : ${formatBytes(totalOriginalSize)}.
                    ${totalCompressedSize > 0 && ` Taille compressée : ${formatBytes(totalCompressedSize)}.`}
                </p>
            </div>
            
            <div class="batch-add-files">
                <button class="btn btn-secondary" onClick=${() => fileInputRef.current?.click()} disabled=${isProcessing}>
                    <${FilesIcon} />
                    <span>Ajouter des fichiers</span>
                </button>
                <input ref=${fileInputRef} type="file" onChange=${handleFileChange} accept="image/*,video/*" multiple style="display:none" />
                
                <button class="btn btn-secondary" onClick=${() => folderInputRef.current?.click()} disabled=${isProcessing}>
                    <${FolderIcon} />
                    <span>Ajouter un dossier</span>
                </button>
                <input ref=${folderInputRef} type="file" onChange=${handleFileChange} webkitdirectory directory multiple style="display:none" />
            </div>

            <div class="batch-options">
                ${imageFiles.length > 0 && html`
                    <div class="image-options">
                        <h3>Options pour les images</h3>
                        <${CompressionOptions}
                            fileType="image"
                            outputFormat=${imageOptions.format}
                            setOutputFormat=${(f: string) => setImageOptions({ ...imageOptions, format: f })}
                            quality=${imageOptions.quality}
                            setQuality=${(q: number) => setImageOptions({ ...imageOptions, quality: q })}
                            disabled=${isProcessing}
                        />
                    </div>
                `}
                ${videoFiles.length > 0 && html`
                     <div class="video-options" style=${imageFiles.length > 0 ? 'margin-top: 1.5rem' : ''}>
                        <h3>Options pour les vidéos</h3>
                        <${CompressionOptions}
                            fileType="video"
                            outputFormat=${videoOptions.format}
                            setOutputFormat=${(f: string) => setVideoOptions({ ...videoOptions, format: f })}
                            quality=${videoOptions.quality}
                            setQuality=${(q: number) => setVideoOptions({ ...videoOptions, quality: q })}
                            disabled=${isProcessing}
                        />
                    </div>
                `}
            </div>

            <div class="batch-file-list">
                ${files.map(batchItem => {
                    const { file, id } = batchItem;
                    const statusInfo = progress[id];
                    const isImage = file.type.startsWith('image/');
                    // @ts-ignore
                    const path = file.webkitRelativePath || file.name;

                    return html`
                        <div class="batch-file-item" key=${id}>
                            <div class="file-item-icon">${isImage ? html`<${ImageFileIcon} />` : html`<${VideoFileIcon} />`}</div>
                            <div class="file-item-info">
                                <span class="file-name" title=${path}>${file.name}</span>
                                ${path !== file.name && html`<span class="file-path" title=${path}>${path.substring(0, path.length - file.name.length)}</span>`}
                            </div>
                            <div class="file-item-size">
                                ${formatBytes(statusInfo.originalSize)}
                                ${statusInfo.compressedSize && statusInfo.status !== 'pending' ? html`
                                    <span> → </span>
                                    <span class="compressed-size">${formatBytes(statusInfo.compressedSize)}</span>
                                ` : ''}
                            </div>
                            <div class="file-item-status">
                                <${FileStatus} statusInfo=${statusInfo} />
                            </div>
                            <button 
                                class="btn-delete" 
                                title="Retirer le fichier" 
                                onClick=${(e: Event) => { e.stopPropagation(); onRemoveFile(id); }}
                                disabled=${isProcessing}
                            >
                                <${TrashIcon} />
                            </button>
                        </div>
                    `;
                })}
            </div>

            <div class="actions">
                <button class="btn btn-secondary" onClick=${onClear} disabled=${isProcessing}>
                    Annuler
                </button>
                <button class="btn btn-primary" onClick=${onStartProcess} disabled=${isProcessing || files.length === 0}>
                     ${isProcessing ? html`<div class="loader"></div> Traitement...` : 'Lancer le traitement'}
                </button>
            </div>
        </div>
    `;
};