import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

interface BucketSettingsModalProps {
    bucketName: string;
    initialDomain: string;
    onSave: (bucket: string, domain: string) => void;
    onClose: () => void;
}

const CloseIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export const BucketSettingsModal = ({ bucketName, initialDomain, onSave, onClose }: BucketSettingsModalProps) => {
    const [domain, setDomain] = useState(initialDomain);

    const handleSave = (e: Event) => {
        e.preventDefault();
        onSave(bucketName, domain.trim());
        onClose();
    };

    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content" onClick=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                    <h2>Bucket Settings</h2>
                    <button class="header-btn" onClick=${onClose} aria-label="Close"><${CloseIcon} /></button>
                </div>
                <form onSubmit=${handleSave}>
                    <div class="modal-body">
                        <p>Configure the public domain for the <strong>${bucketName}</strong> bucket.</p>
                        <div class="form-group">
                            <label for="public-domain">R2 Public Domain</label>
                            <input
                                type="text"
                                id="public-domain"
                                placeholder="ex: pub-xxxxxxxx.r2.dev"
                                value=${domain}
                                onInput=${(e: Event) => setDomain((e.target as HTMLInputElement).value)}
                            />
                            <small class="light-text" style="margin-top: 0.5rem; display: block; line-height: 1.4;">
                                You can find this in your R2 bucket settings. This value is saved locally in your browser.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancel</button>
                        <button type="submit" class="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};