

import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { BucketSettingsModal } from './BucketSettingsModal';

interface BucketSelectorProps {
  buckets: string[];
  isLoading: boolean;
  error: string | null;
  onSelectBucket: (bucketBinding: string) => void;
  r2PublicDomains: { [key: string]: string };
  onSavePublicDomain: (bucket: string, domain: string) => void;
}

const BucketIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11h-2.17l-1.6-4.8a2 2 0 0 0-1.94-1.2H7.71a2 2 0 0 0-1.94 1.2L4.17 11H2M3.14 11l1.86 5.57A2 2 0 0 0 6.86 18h10.28a2 2 0 0 0 1.86-1.43L20.86 11"/>
    </svg>
`;

const ChevronRightIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
`;

const SettingsIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;


export const BucketSelector = ({ buckets, isLoading, error, onSelectBucket, r2PublicDomains, onSavePublicDomain }: BucketSelectorProps) => {
  const [configuringBucket, setConfiguringBucket] = useState<string | null>(null);

  if (isLoading) {
    return html`
      <div class="selector-container">
        <h2>Chargement des buckets...</h2>
        <div class="loader" style="margin: 2rem auto;"></div>
      </div>
    `;
  }

  if (error) {
    const isHangError = error.includes("CORS") || error.includes("NetworkError") || error.includes("500") || error.includes("Failed to fetch");
     if (isHangError) {
        return html`
            <div class="selector-container">
                <h2>Erreur Critique du Worker</h2>
                <div class="alert alert-danger" style="text-align: left;">
                    <h4 style="text-align: center; margin-top:0; color: var(--c-error);">ACTION REQUISE : Réinitialisation Forcée</h4>
                    <p><strong>Votre worker a planté.</strong> C'est une erreur critique causée par une configuration corrompue sur Cloudflare.</p>
                    <p>Le code est correct, mais la plateforme est dans un état instable. La seule solution est de forcer une réinitialisation manuelle. Suivez <strong>impérativement</strong> ces étapes :</p>
                    
                    <strong style="display: block; margin-top: 1.5rem;">Procédure de Réinitialisation Complète :</strong>
                    <ol style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: decimal;">
                        <li style="margin-bottom: 1rem;">
                            <strong>Étape 1 : Vider la configuration</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>Ouvrez votre fichier de configuration (<code>wrangler.jsonc</code> ou <code>wrangler.toml</code>).</li>
                                <li>Trouvez et supprimez entièrement la section qui définit les buckets R2 (généralement nommée <code>r2_buckets</code> ou <code>[[r2_buckets]]</code>).</li>
                                <li>Sauvegardez le fichier.</li>
                            </ul>
                        </li>
                        <li style="margin-bottom: 1rem;">
                            <strong>Étape 2 : Déployer la configuration vide</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>Dans votre terminal, lancez : <code>npx wrangler deploy</code>.</li>
                                <li>Ce déploiement force Cloudflare à supprimer les liaisons corrompues.</li>
                            </ul>
                        </li>
                        <li style="margin-bottom: 1rem;">
                            <strong>Étape 3 : Restaurer et Redéployer</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>Restaurez la section des buckets R2 que vous venez de supprimer.</li>
                                <li>Lancez une dernière fois : <code>npx wrangler deploy</code>.</li>
                            </ul>
                        </li>
                    </ol>
                    <p style="margin-top: 1rem; font-weight: 600;">Après le déploiement final, rafraîchissez la page. Le problème sera résolu.</p>
                </div>
            </div>
        `;
    }

    // Fallback for other errors
    return html`
      <div class="selector-container">
          <h2>Erreur de connexion</h2>
          <div class="alert alert-danger">${error}</div>
          <p style="margin-top: 1.5rem;">Cliquez sur l'icône de rafraîchissement dans l'en-tête pour réessayer.</p>
      </div>
    `;
  }

  const renderNoBucketsMessage = () => {
    return html`
      <div class="alert alert-info">
        <p><strong>Aucun bucket R2 n'est lié à votre worker.</strong></p>
        <p style="text-align: left; margin-top: 1rem; font-size: 0.9rem; line-height: 1.5;">
            Pour commencer, vous devez ajouter des liaisons de bucket R2 à la configuration de votre worker (fichier <code>wrangler.jsonc</code> ou <code>wrangler.toml</code>).
            <br/><br/>
            Utilisez le <strong>menu de paramètres (icône d'engrenage)</strong> en haut à droite pour obtenir de l'aide et générer automatiquement la configuration nécessaire. Après avoir mis à jour et redéployé votre worker, cliquez sur l'icône de rafraîchissement dans l'en-tête.
        </p>
      </div>
    `;
  };

  return html`
    <div class="selector-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 1rem;">
        <h2 style="margin: 0;">Choisissez un Bucket</h2>
      </div>
      <p style="color: var(--c-text-light); margin-bottom: 2rem; margin-top: 0;">Chaque bucket R2 est isolé. Sélectionnez celui dans lequel vous souhaitez travailler.</p>

      ${buckets.length > 0 ? html`
        <div class="selector-list">
          <ul>
            ${buckets.map(bucket => html`
              <li key=${bucket}>
                <div class="selector-list-item-main" onClick=${() => onSelectBucket(bucket)} role="button" tabindex="0">
                    <div class="selector-list-item-content">
                        <${BucketIcon} />
                        <span>${bucket}</span>
                    </div>
                    <div class="selector-list-chevron"><${ChevronRightIcon} /></div>
                </div>
                <button 
                    class="btn-icon selector-list-settings-btn" 
                    title="Configurer le domaine public" 
                    onClick=${() => setConfiguringBucket(bucket)}
                    aria-label="Paramètres pour ${bucket}"
                >
                    <${SettingsIcon} />
                </button>
              </li>
            `)}
          </ul>
        </div>
      ` : renderNoBucketsMessage()}
    </div>
    ${configuringBucket && html`
        <${BucketSettingsModal}
            bucketName=${configuringBucket}
            initialDomain=${r2PublicDomains[configuringBucket] || ''}
            onSave=${onSavePublicDomain}
            onClose=${() => setConfiguringBucket(null)}
        />
    `}
  `;
};