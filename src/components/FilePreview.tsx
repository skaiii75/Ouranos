import { html } from 'htm/preact';
import { formatBytes } from '../utils/formatters';

interface FilePreviewProps {
    file: File;
    fileType: 'image' | 'video';
    previewUrl: string;
}

export const FilePreview = ({ file, fileType, previewUrl }: FilePreviewProps) => {
    if (!file) return null;

    return html`
        <div class="file-details">
          <p><strong>File:</strong> ${file.name} (${formatBytes(file.size)})</p>
          <div class="preview">
            ${fileType === 'image' ? html`<img src=${previewUrl} alt="File preview" />` : html`<video src=${previewUrl} controls />`}
          </div>
        </div>
    `;
}