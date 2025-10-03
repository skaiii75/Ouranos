
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
        setError("Veuillez entrer une URL valide commençant par https://");
        return;
    }
    setIsLoading(true);
    setError(null);
    logger.info(`Tentative de connexion au worker: ${trimmedUrl}`);
    try {
        await getAvailableBuckets(trimmedUrl);
        logger.info(`Connexion au worker réussie.`);
        onUrlSaved(trimmedUrl);
    } catch (e: any) {
        logger.error(`Échec de la connexion au worker`, { error: e.message, stack: e.stack });
        setError(`Échec de la connexion : ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return html`
    <div class="project-selector-container">
      <h1 style="color: var(--c-primary); margin-bottom: 0.5rem;">Bienvenue sur Ouranos</h1>
      <p style="color: var(--c-text-light); margin-top: 0; margin-bottom: 2rem;">Pour commencer, veuillez connecter l'application à votre Worker Cloudflare.</p>
      
      <form onSubmit=${handleSubmit}>
        <div class="form-group" style="text-align: left; margin-bottom: 1rem;">
          <label for="workerUrl">URL de votre Worker</label>
          <input 
            type="url" 
            id="workerUrl"
            placeholder="https://ouranos-worker.votre-nom.workers.dev" 
            value=${url} 
            onInput=${(e: Event) => setUrl((e.target as HTMLInputElement).value)}
            aria-label="URL du worker Cloudflare"
            required
          />
          <small style="color: var(--c-text-light); margin-top: 0.5rem; display: block; line-height: 1.4;">
            Cette URL est fournie par Cloudflare après avoir déployé votre worker avec la commande <code>npx wrangler deploy</code>.
          </small>
        </div>
        
        <button type="submit" class="btn btn-primary" disabled=${isLoading}>
            ${isLoading ? html`<div class="loader"></div> Connexion...` : 'Se connecter et sauvegarder'}
        </button>
      </form>
      ${error && html`<div class="alert alert-danger" style="margin-top: 1.5rem;">${error}</div>`}
    </div>
  `;
};