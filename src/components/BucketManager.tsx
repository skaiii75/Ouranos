

import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { listR2Buckets, R2Bucket } from '../utils/cloudflareApi';
import { slugify } from '../utils/formatters';
import { logger } from '../utils/logger';

interface BucketManagerProps {
  workerUrl: string;
  activeBuckets: string[];
  onClose: () => void;
}

const CloseIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const KeyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
const AccountIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const CopyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const generateBindingName = (bucketName: string) => {
    return slugify(bucketName).replace(/-/g, '_').toUpperCase();
};

export const BucketManager = ({ workerUrl, activeBuckets, onClose }: BucketManagerProps) => {
    const [accountId, setAccountId] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableBuckets, setAvailableBuckets] = useState<R2Bucket[]>([]);
    const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());
    const [generatedConfig, setGeneratedConfig] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        setAccountId(localStorage.getItem('ouranos-cf-account-id') || '');
        const initialSelected = new Set<string>();
        activeBuckets.forEach(b => initialSelected.add(b));
        setSelectedBuckets(initialSelected);
    }, [activeBuckets]);

    useEffect(() => {
        if (availableBuckets.length === 0 || !accountId) {
            setGeneratedConfig('');
            return;
        }

        const r2_buckets_array = Array.from(selectedBuckets)
            .map(bindingName => {
                const bucket = availableBuckets.find(b => generateBindingName(b.name) === bindingName);
                if (!bucket) return null;
                return {
                    binding: bindingName,
                    bucket_name: bucket.name
                };
            })
            .filter((b): b is { binding: string; bucket_name: string } => b !== null)
            .sort((a,b) => a.binding.localeCompare(b.binding));
            
        if (r2_buckets_array.length === 0) {
            setGeneratedConfig('');
            return;
        }
        
        const configObject = {
            name: "ouranos-worker",
            main: "src/index.js",
            compatibility_date: "2024-05-15",
            account_id: accountId,
            r2_buckets: r2_buckets_array
        };
        
        setGeneratedConfig(JSON.stringify(configObject, null, 2));
    }, [selectedBuckets, availableBuckets, accountId]);

    const handleFetchBuckets = async () => {
        setIsLoading(true);
        setError(null);
        setAvailableBuckets([]);
        try {
            const buckets = await listR2Buckets(workerUrl, accountId, apiToken);
            setAvailableBuckets(buckets);
            localStorage.setItem('ouranos-cf-account-id', accountId);
            logger.info('Cloudflare account ID saved locally.');
            
            const newSelected = new Set<string>();
            buckets.forEach(bucket => {
                const bindingName = generateBindingName(bucket.name);
                if (selectedBuckets.has(bindingName) || activeBuckets.includes(bindingName)) {
                    newSelected.add(bindingName);
                }
            });
            setSelectedBuckets(newSelected);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckboxChange = (bindingName: string, isChecked: boolean) => {
        const newSelected = new Set(selectedBuckets);
        if (isChecked) {
            newSelected.add(bindingName);
        } else {
            newSelected.delete(bindingName);
        }
        setSelectedBuckets(newSelected);
    };

    const handleCopyToClipboard = () => {
        if (!generatedConfig) return;
        navigator.clipboard.writeText(generatedConfig).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content" onClick=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                    <h2>Manage Buckets</h2>
                    <button class="header-btn" onClick=${onClose} aria-label="Close"><${CloseIcon} /></button>
                </div>
                <div class="modal-body">
                    <p class="alert alert-info" style="text-align: left; font-size: 0.9rem;">
                        To sync your R2 buckets, provide your Cloudflare Account ID and an API token with the <code>R2:Read</code> permission.
                        The token is only used for this session and is never saved.
                    </p>
                    <div class="form-group">
                        <label for="accountId">Cloudflare Account ID</label>
                        <div class="form-group-icon">
                            <${AccountIcon} />
                            <input type="text" id="accountId" value=${accountId} onInput=${(e: any) => setAccountId(e.target.value)} placeholder="Your account ID here..." />
                        </div>
                    </div>
                     <div class="form-group">
                        <label for="apiToken">Cloudflare API Token</label>
                        <div class="form-group-icon">
                            <${KeyIcon} />
                            <input type="password" id="apiToken" value=${apiToken} onInput=${(e: any) => setApiToken(e.target.value)} placeholder="paste token (R2:Read)..." />
                        </div>
                    </div>
                     <button class="btn btn-primary" onClick=${handleFetchBuckets} disabled=${isLoading || !accountId || !apiToken}>
                        ${isLoading ? html`<div class="loader"></div> Fetching...` : 'List Account Buckets'}
                     </button>
                    ${error && html`<div class="alert alert-danger" style="margin-top: 1rem;">${error}</div>`}
                    
                    ${availableBuckets.length > 0 && html`
                        <div style="margin-top: 1.5rem;">
                            <h3>Buckets found on your account</h3>
                            <p class="light-text" style="font-size: 0.9rem;">Check the buckets you want to bind to your worker.</p>
                            <div class="bucket-manager-list">
                                ${availableBuckets.map(bucket => {
                                    const bindingName = generateBindingName(bucket.name);
                                    return html`
                                        <label key=${bucket.name}>
                                            <input type="checkbox" checked=${selectedBuckets.has(bindingName)} onChange=${(e: any) => handleCheckboxChange(bindingName, e.target.checked)} />
                                            <span>${bucket.name} (<code>${bindingName}</code>)</span>
                                        </label>
                                    `;
                                })}
                            </div>
                        </div>
                    `}
                    
                    ${generatedConfig && html`
                        <div style="margin-top: 1rem;">
                            <h3>Configuration to Add</h3>
                            <p class="light-text" style="font-size: 0.9rem;">Copy this content into your <code>wrangler.jsonc</code> file, then redeploy your worker with <code>npx wrangler deploy</code>.</p>
                            <div class="config-output">
                                <pre>${generatedConfig}</pre>
                                <button class="copy-btn" onClick=${handleCopyToClipboard}>
                                    ${copySuccess ? 'Copied!' : html`<${CopyIcon} /> Copy`}
                                </button>
                            </div>
                        </div>
                    `}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onClick=${onClose}>Close</button>
                </div>
            </div>
        </div>
    `;
};