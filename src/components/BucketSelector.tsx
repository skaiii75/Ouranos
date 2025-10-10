

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

const SettingsIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;


export const BucketSelector = ({ buckets, isLoading, error, onSelectBucket, r2PublicDomains, onSavePublicDomain }: BucketSelectorProps) => {
  const [configuringBucket, setConfiguringBucket] = useState<string | null>(null);

  if (isLoading) {
    return html`
      <div class="selector-container">
        <h2>Loading buckets...</h2>
        <div class="loader" style="margin: 2rem auto;"></div>
      </div>
    `;
  }

  if (error) {
    const isHangError = error.includes("CORS") || error.includes("NetworkError") || error.includes("500") || error.includes("Failed to fetch");
     if (isHangError) {
        return html`
            <div class="selector-container">
                <h2>Critical Worker Error</h2>
                <div class="alert alert-danger" style="text-align: left;">
                    <h4 style="text-align: center; margin-top:0; color: var(--c-error);">ACTION REQUIRED: Force Reset</h4>
                    <p><strong>Your worker has crashed.</strong> This is a critical error caused by a corrupt configuration on Cloudflare.</p>
                    <p>The code is correct, but the platform is in an unstable state. The only solution is to force a manual reset. You <strong>must</strong> follow these steps:</p>
                    
                    <strong style="display: block; margin-top: 1.5rem;">Full Reset Procedure:</strong>
                    <ol style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: decimal;">
                        <li style="margin-bottom: 1rem;">
                            <strong>Step 1: Clear Configuration</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>Open your configuration file (<code>wrangler.jsonc</code> or <code>wrangler.toml</code>).</li>
                                <li>Find and completely delete the section that defines the R2 buckets (usually named <code>r2_buckets</code> or <code>[[r2_buckets]]</code>).</li>
                                <li>Save the file.</li>
                            </ul>
                        </li>
                        <li style="margin-bottom: 1rem;">
                            <strong>Step 2: Deploy Empty Configuration</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>In your terminal, run: <code>npx wrangler deploy</code>.</li>
                                <li>This deployment forces Cloudflare to delete the corrupt bindings.</li>
                            </ul>
                        </li>
                        <li style="margin-bottom: 1rem;">
                            <strong>Step 3: Restore and Redeploy</strong>
                            <ul style="padding-left: 1.2rem; margin-top: 0.5rem; list-style-type: '→ '; line-height: 1.6;">
                                <li>Restore the R2 buckets section you just deleted.</li>
                                <li>Run one last time: <code>npx wrangler deploy</code>.</li>
                            </ul>
                        </li>
                    </ol>
                    <p style="margin-top: 1rem; font-weight: 600;">After the final deployment, refresh the page. The problem will be resolved.</p>
                </div>
            </div>
        `;
    }

    // Fallback for other errors
    return html`
      <div class="selector-container">
          <h2>Connection Error</h2>
          <div class="alert alert-danger">${error}</div>
          <p style="margin-top: 1.5rem;">Click the refresh icon in the header to retry.</p>
      </div>
    `;
  }

  const renderNoBucketsMessage = () => {
    return html`
      <div class="alert alert-info">
        <p><strong>No R2 buckets are bound to your worker.</strong></p>
        <p style="text-align: left; margin-top: 1rem; font-size: 0.9rem; line-height: 1.5;">
            To get started, you need to add R2 bucket bindings to your worker's configuration file (<code>wrangler.jsonc</code> or <code>wrangler.toml</code>).
            <br/><br/>
            Use the <strong>settings menu (gear icon)</strong> in the top right to get help and automatically generate the necessary configuration. After updating and redeploying your worker, click the refresh icon in the header.
        </p>
      </div>
    `;
  };

  return html`
    <div class="selector-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 1rem;">
        <h2 style="margin: 0;">Choose a Bucket</h2>
      </div>
      <p style="color: var(--c-text-light); margin-bottom: 2rem; margin-top: 0;">Each R2 bucket is isolated. Select the one you want to work in.</p>

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
                    title="Configure public domain" 
                    onClick=${() => setConfiguringBucket(bucket)}
                    aria-label="Settings for ${bucket}"
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