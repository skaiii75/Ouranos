import { slugify } from './formatters';
import { logger } from './logger';

export const apiFetch = async (workerUrl: string, endpoint: string, options: RequestInit = {}) => {
  if (!workerUrl) {
    throw new Error("L'URL du worker n'est pas configurée.");
  }
  const url = `${workerUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const headers: HeadersInit = { ...options.headers };
  // Only add Content-Type for requests with a body, to avoid unnecessary CORS preflight on GET requests
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
  logger.network(`Requête API: ${options.method || 'GET'} ${url}`, { options });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Le serveur a répondu avec le statut : ${response.status} ${response.statusText}` }));
      logger.error(`Erreur API: ${response.status} ${response.statusText}`, { url, errorData });
      throw new Error(errorData.error || errorData.message || `Erreur API : ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      logger.network(`Réponse API (JSON) pour ${url}`, { status: response.status, data });
      return data;
    } else {
      // Pour les requêtes comme DELETE qui peuvent ne pas retourner de corps
      logger.network(`Réponse API (non-JSON) pour ${url}`, { status: response.status });
      return; 
    }
  } catch (error: any) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          let friendlyError = `Erreur réseau ou problème de CORS. Impossible de contacter le worker à l'adresse ${workerUrl}.`;
          friendlyError += `\n\n- Vérifiez que l'URL est correcte et que le worker est bien déployé.\n- Assurez-vous que la configuration CORS du worker autorise les requêtes de cette application.`;
          logger.error('Erreur réseau ou CORS', { url, error: error.message });
          throw new Error(friendlyError);
      }
      if (!error.message.startsWith('Erreur API')) {
         logger.error(`Erreur inattendue dans apiFetch pour ${url}`, { error: error.message, stack: error.stack });
      }
      throw error;
  }
};

export interface BucketsResponse {
    buckets: string[];
    version?: string;
    debug_env_keys?: string[];
}

/**
 * Fetches the available R2 bucket bindings from the worker.
 * The worker should have a GET /buckets endpoint.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @returns A promise that resolves to an object containing bucket binding names and an optional version.
 */
export const getAvailableBuckets = async (workerUrl: string): Promise<BucketsResponse> => {
    // The worker should return a payload like: { buckets: ["CLIENT_A"], version: "1.1.0" }
    // We use 'no-store' to ensure we always get the latest configuration from the worker.
    const response = await apiFetch(workerUrl, '/buckets', { cache: 'no-store' });
    if (!response || !Array.isArray(response.buckets)) {
        throw new Error("La réponse de l'API pour les buckets est invalide.");
    }
    return response as BucketsResponse;
};

/**
 * Fetches the list of top-level folders (prefixes) from an R2 bucket via the worker.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param bucketBinding The binding name of the bucket.
 * @returns A promise that resolves to an array of folder names.
 */
export const getFoldersForBucket = async (workerUrl: string, bucketBinding: string): Promise<string[]> => {
    const response = await apiFetch(workerUrl, '/list-folders', {
        method: 'GET',
        headers: {
            'X-Bucket-Binding': bucketBinding,
        }
    });
    if (!response || !Array.isArray(response.folders)) {
        throw new Error("La réponse de l'API pour les dossiers est invalide.");
    }
    return response.folders;
};

/**
 * Uploads a file directly to R2 by streaming it through the backend worker.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param bucketBinding The binding name of the bucket.
 * @param objectKey The full path/key for the object in the bucket.
 * @param fileBlob The file content as a Blob.
 * @param contentType The MIME type of the file.
 */
export const uploadFileToR2 = async (workerUrl: string, bucketBinding: string, objectKey: string, fileBlob: Blob, contentType: string): Promise<void> => {
    const endpoint = '/upload-file';
    const url = `${workerUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    
    logger.network(`Téléversement direct via worker...`, { url, bucketBinding, objectKey, contentType, size: fileBlob.size });

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: fileBlob,
            headers: {
                'Content-Type': contentType,
                'X-Bucket-Binding': bucketBinding,
                'X-Object-Key': encodeURIComponent(objectKey),
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Le serveur a répondu avec le statut : ${response.status} ${response.statusText}` }));
            logger.error(`Erreur de téléversement direct: ${response.status}`, { url, errorData });
            throw new Error(errorData.error || errorData.message || `Erreur de téléversement : ${response.status}`);
        }

        logger.network(`Téléversement direct via worker réussi.`);
    } catch (error: any) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            const friendlyError = `Erreur réseau ou CORS. Impossible de contacter le worker à l'adresse ${workerUrl} pour le téléversement.`;
            logger.error('Erreur réseau ou CORS (téléversement)', { url, error: error.message });
            throw new Error(friendlyError);
        }
        if (!error.message.startsWith('Erreur')) {
           logger.error(`Erreur inattendue dans uploadFileToR2 pour ${url}`, { error: error.message, stack: error.stack });
        }
        throw error;
    }
};
