import { html } from 'htm/preact';
import { IMAGE_FORMATS, VIDEO_FORMATS } from '../constants';

interface CompressionOptionsProps {
    fileType: 'image' | 'video';
    outputFormat: string;
    setOutputFormat: (format: string) => void;
    quality: number;
    setQuality: (quality: number) => void;
    disabled?: boolean;
}

export const CompressionOptions = ({ fileType, outputFormat, setOutputFormat, quality, setQuality, disabled = false }: CompressionOptionsProps) => {
    const availableFormats = fileType === 'image' ? IMAGE_FORMATS : VIDEO_FORMATS;

    return html`
        <div class="options-grid">
            <div class="option">
                <label for="format">Format de sortie</label>
                <select id="format" value=${outputFormat} onChange=${(e: Event) => setOutputFormat((e.target as HTMLSelectElement).value)} disabled=${disabled}>
                    ${Object.entries(availableFormats).map(([mime, name]) => html`<option value=${mime}>${name}</option>`)}
                </select>
            </div>
            <div class="option">
                <label for="quality">Qualité</label>
                <div class="quality-slider">
                  <input type="range" id="quality" min="0.1" max="1" step="0.05" value=${quality} onChange=${(e: Event) => setQuality(parseFloat((e.target as HTMLInputElement).value))} disabled=${disabled} />
                  <span>${Math.round(quality * 100)}%</span>
                </div>
            </div>
        </div>
    `;
};
