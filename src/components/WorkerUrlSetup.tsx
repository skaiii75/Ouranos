
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { getAvailableBuckets } from '../utils/r2';
import { logger } from '../utils/logger';

interface WorkerUrlSetupProps {
  onUrlSaved: (url: string) => void;
}

export const WorkerUrlSetup = ({ onUrlSaved }: WorkerUrlSetupProps) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('https://')) {
        setError("Please enter a valid URL beginning with https://");
        return;
    }
    setIsLoading(true);
    setError(null);
    logger.info(`Attempting to connect to worker: ${trimmedUrl}`);
    try {
        await getAvailableBuckets(trimmedUrl);
        logger.info(`Successfully connected to worker.`);
        onUrlSaved(trimmedUrl);
    } catch (e: any) {
        logger.error(`Failed to connect to worker`, { error: e.message, stack: e.stack });
        setError(`Connection failed: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return html`
    <div class="project-selector-container">
      <h1 style="color: var(--c-primary); margin-bottom: 0.5rem;">Welcome to Ouranos</h1>
      <p style="color: var(--c-text-light); margin-top: 0; margin-bottom: 2rem;">To begin, please connect the application to your Cloudflare Worker.</p>
      
      <form onSubmit=${handleSubmit}>
        <div class="form-group" style="text-align: left; margin-bottom: 1rem;">
          <label for="workerUrl">Your Worker URL</label>
          <input 
            type="url" 
            id="workerUrl"
            placeholder="https://ouranos-worker.your-name.workers.dev" 
            value=${url} 
            onInput=${(e: Event) => setUrl((e.target as HTMLInputElement).value)}
            aria-label="Cloudflare Worker URL"
            required
          />
          <small style="color: var(--c-text-light); margin-top: 0.5rem; display: block; line-height: 1.4;">
            This URL is provided by Cloudflare after deploying your worker with the <code>npx wrangler deploy</code> command.
          </small>
        </div>
        
        <button type="submit" class="btn btn-primary" disabled=${isLoading}>
            ${isLoading ? html`<div class="loader"></div> Connecting...` : 'Connect and Save'}
        </button>
      </form>
      ${error && html`<div class="alert alert-danger" style="margin-top: 1.5rem;">${error}</div>`}
    </div>
  `;
};