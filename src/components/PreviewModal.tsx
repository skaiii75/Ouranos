import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import type { R2Object } from '../utils/r2';

const CloseIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const CopyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const DownloadIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;


interface PreviewModalProps {
    object: R2Object;
    publicUrl: string;
    onClose: () => void;
}

export const PreviewModal = ({ object, publicUrl, onClose }: PreviewModalProps) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const isImage = object.httpMetadata?.contentType?.startsWith('image/');
    const isVideo = object.httpMetadata?.contentType?.startsWith('video/');
    const fileName = object.key.split('/').pop() || object.key;

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };
    
     useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);


    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content preview-modal-content" onClick=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header preview-modal-header">
                     <button class="header-btn" onClick=${onClose} aria-label="Fermer"><${CloseIcon} /></button>
                </div>
                <div class="modal-body preview-modal-body">
                    ${isImage && html`<img src=${publicUrl} alt=${fileName} class="preview-modal-media" />`}
                    ${isVideo && html`<video src=${publicUrl} controls autoplay class="preview-modal-media" />`}
                </div>
                 <div class="modal-footer preview-modal-footer">
                    <button class="btn btn-secondary" onClick=${handleCopy}>
                        ${copySuccess ? '✓ Copié !' : html`<${CopyIcon} /> Copier l'URL`}
                    </button>
                    <a href=${publicUrl} download=${fileName} target="_blank" class="btn btn-primary">
                        <${DownloadIcon} />
                        <span>Télécharger</span>
                    </a>
                </div>
            </div>
        </div>
    `;
};
