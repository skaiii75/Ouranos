

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
        throw new Error("Account ID and API Token are required.");
    }
    
    logger.info(`Fetching bucket list for account ${accountId.slice(0, 8)}...`);
    try {
        // The call now goes to our own worker, which will proxy the request to the Cloudflare API.
        const response = await apiFetch(workerUrl, '/list-cf-buckets', {
            method: 'POST',
            body: JSON.stringify({ accountId, apiToken })
        });
        
        if (!response || !Array.isArray(response.buckets)) {
            // This error comes from our worker if its response is malformed.
            throw new Error("The worker's response for the bucket list is invalid.");
        }
        
        logger.info(`Cloudflare buckets fetched successfully`, { count: response.buckets.length });
        return response.buckets;
        
    } catch (error: any) {
        // Errors from apiFetch are already parsed. We can re-throw them.
        // If the worker forwarded an error from the Cloudflare API, it will be in error.message.
        logger.error(`Failed to fetch Cloudflare buckets`, { error: error.message });
        throw error;
    }
};