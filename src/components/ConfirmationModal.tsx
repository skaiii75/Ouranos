import { html } from 'htm/preact';
import { VNode } from 'preact';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: VNode | VNode[];
}

const CloseIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }: ConfirmationModalProps) => {
    if (!isOpen) {
        return null;
    }

    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content" onClick=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="header-btn" onClick=${onClose} aria-label="Fermer"><${CloseIcon} /></button>
                </div>
                <div class="modal-body">
                    ${children}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onClick=${onClose}>Annuler</button>
                    <button type="button" class="btn btn-primary" style="background: var(--c-error);" onClick=${onConfirm}>Confirmer</button>
                </div>
            </div>
        </div>
    `;
};