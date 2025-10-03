
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { logger, LogEntry } from '../utils/logger';

interface LogViewerProps {
  onClose: () => void;
}

const LogIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
const CloseIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export const LogViewer = ({ onClose }: LogViewerProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
        setLogs(newLogs);
        // Auto-scroll to bottom
        setTimeout(() => {
            if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
        }, 0);
    });
    return () => unsubscribe();
  }, []);

  const handleClear = () => {
    logger.clear();
  };

  const getLogLevelClass = (level: string) => {
    return `log-level-${level.toLowerCase()}`;
  };

  return html`
    <div class="modal-overlay log-viewer-overlay" onClick=${onClose}>
      <div class="modal-content log-viewer-content" onClick=${(e: Event) => e.stopPropagation()}>
        <div class="modal-header">
          <div class="log-viewer-title">
            <${LogIcon} />
            <h2>Logs de l'application</h2>
          </div>
          <button class="header-btn" onClick=${onClose} aria-label="Fermer les logs"><${CloseIcon} /></button>
        </div>
        <div class="modal-body log-viewer-body" ref=${logContainerRef}>
          ${logs.length === 0
            ? html`<div class="no-logs-message">Aucun log à afficher. Interagissez avec l'application pour générer des logs.</div>`
            : html`
                <ul class="log-list">
                  ${logs.map(log => html`
                    <li class="log-entry ${getLogLevelClass(log.level)}">
                      <span class="log-timestamp">${log.timestamp}</span>
                      <span class="log-level">[${log.level}]</span>
                      <span class="log-message">${log.message}</span>
                      ${log.data && html`<pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre>`}
                    </li>
                  `)}
                </ul>
              `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onClick=${handleClear}>Vider les logs</button>
          <button class="btn btn-primary" onClick=${onClose}>Fermer</button>
        </div>
      </div>
    </div>
  `;
};
