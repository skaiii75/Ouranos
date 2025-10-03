

import { apiFetch } from './r2';
import { logger } from './logger';

export interface R2Bucket {
    name: string;
    creation_date: string;
}

/**
 * Fetches the list of all R2 buckets from a Cloudflare account via the backend worker proxy.
 * This avoids CORS issues by not calling the Cloudflare API from the browser directly.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param accountId Your Cloudflare Account ID.
 * @param apiToken Your Cloudflare API Token (with R2:Read permissions).
 * @returns A promise that resolves to an array of bucket objects.
 */
export const listR2Buckets = async (workerUrl: string, accountId: string, apiToken: string): Promise<R2Bucket[]> => {
    if (!accountId || !apiToken) {
        throw new Error("L'ID de compte et le jeton d'API sont requis.");
    }
    
    logger.info(`Récupération de la liste des buckets pour le compte ${accountId.slice(0, 8)}...`);
    try {
        // The call now goes to our own worker, which will proxy the request to the Cloudflare API.
        const response = await apiFetch(workerUrl, '/list-cf-buckets', {
            method: 'POST',
            body: JSON.stringify({ accountId, apiToken })
        });
        
        if (!response || !Array.isArray(response.buckets)) {
            // This error comes from our worker if its response is malformed.
            throw new Error("La réponse du worker pour la liste des buckets est invalide.");
        }
        
        logger.info(`Buckets Cloudflare récupérés avec succès`, { count: response.buckets.length });
        return response.buckets;
        
    } catch (error: any) {
        // Errors from apiFetch are already parsed. We can re-throw them.
        // If the worker forwarded an error from the Cloudflare API, it will be in error.message.
        logger.error(`Échec de la récupération des buckets Cloudflare`, { error: error.message });
        throw error;
    }
};