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
                    <h2>Paramètres du Bucket</h2>
                    <button class="header-btn" onClick=${onClose} aria-label="Fermer"><${CloseIcon} /></button>
                </div>
                <form onSubmit=${handleSave}>
                    <div class="modal-body">
                        <p>Configurez le domaine public pour le bucket <strong>${bucketName}</strong>.</p>
                        <div class="form-group">
                            <label for="public-domain">Domaine Public R2</label>
                            <input
                                type="text"
                                id="public-domain"
                                placeholder="ex: pub-xxxxxxxx.r2.dev"
                                value=${domain}
                                onInput=${(e: Event) => setDomain((e.target as HTMLInputElement).value)}
                            />
                            <small class="light-text" style="margin-top: 0.5rem; display: block; line-height: 1.4;">
                                Vous trouverez ceci dans les paramètres de votre bucket R2. Cette valeur est sauvegardée localement dans votre navigateur.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onClick=${onClose}>Annuler</button>
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};
