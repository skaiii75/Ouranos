import { slugify } from './formatters';
import { logger } from './logger';

export const apiFetch = async (workerUrl: string, endpoint: string, options: RequestInit = {}) => {
  if (!workerUrl) {
    throw new Error("Worker URL is not configured.");
  }
  const url = `${workerUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const headers: HeadersInit = { ...options.headers };
  // Only add Content-Type for requests with a body, to avoid unnecessary CORS preflight on GET requests
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
  logger.network(`API Request: ${options.method || 'GET'} ${url}`, { options });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Server responded with status: ${response.status} ${response.statusText}` }));
      logger.error(`API Error: ${response.status} ${response.statusText}`, { url, errorData });
      throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      logger.network(`API Response (JSON) for ${url}`, { status: response.status, data });
      return data;
    } else {
      // For requests like DELETE that may not return a body
      logger.network(`API Response (non-JSON) for ${url}`, { status: response.status });
      return; 
    }
  } catch (error: any) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          let friendlyError = `Network error or CORS issue. Could not contact the worker at ${workerUrl}.`;
          friendlyError += `\n\n- Check that the URL is correct and the worker is deployed.\n- Ensure the worker's CORS configuration allows requests from this application.`;
          logger.error('Network or CORS error', { url, error: error.message });
          throw new Error(friendlyError);
      }
      if (!error.message.startsWith('API Error')) {
         logger.error(`Unexpected error in apiFetch for ${url}`, { error: error.message, stack: error.stack });
      }
      throw error;
  }
};

export interface BucketsResponse {
    buckets: string[];
    version?: string;
    debug_env_keys?: string[];
}

export interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    uploaded: string; // ISO 8601 date string
    httpMetadata?: {
        contentType?: string;
    };
}

export interface ListObjectsResponse {
    objects: R2Object[];
    delimitedPrefixes: string[];
    cursor?: string;
    truncated: boolean;
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
        throw new Error("The API response for buckets is invalid.");
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
        throw new Error("The API response for folders is invalid.");
    }
    return response.folders;
};

/**
 * Fetches the list of objects (files) for a given prefix from an R2 bucket via the worker.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param bucketBinding The binding name of the bucket.
 * @param prefix The folder path to list objects from.
 * @param cursor Optional cursor for pagination.
 * @returns A promise that resolves to an object containing the list of objects and pagination info.
 */
export const getObjectsForPrefix = async (workerUrl: string, bucketBinding: string, prefix: string, cursor?: string): Promise<ListObjectsResponse> => {
    const response = await apiFetch(workerUrl, '/list-objects', {
        method: 'GET',
        headers: {
            'X-Bucket-Binding': bucketBinding,
            'X-Prefix': prefix,
            ...(cursor && { 'X-Cursor': cursor }),
        }
    });
    if (!response || !Array.isArray(response.objects)) {
        throw new Error("The API response for objects is invalid.");
    }
    return response as ListObjectsResponse;
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
    
    logger.network(`Direct upload via worker...`, { url, bucketBinding, objectKey, contentType, size: fileBlob.size });

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
            const errorData = await response.json().catch(() => ({ message: `Server responded with status: ${response.status} ${response.statusText}` }));
            logger.error(`Direct upload error: ${response.status}`, { url, errorData });
            throw new Error(errorData.error || errorData.message || `Upload error: ${response.status}`);
        }

        logger.network(`Direct upload via worker successful.`);
    } catch (error: any) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            const friendlyError = `Network error or CORS issue. Could not contact the worker at ${workerUrl} for the upload.`;
            logger.error('Network or CORS error (upload)', { url, error: error.message });
            throw new Error(friendlyError);
        }
        if (!error.message.startsWith('Error')) {
           logger.error(`Unexpected error in uploadFileToR2 for ${url}`, { error: error.message, stack: error.stack });
        }
        throw error;
    }
};

/**
 * Deletes multiple objects and/or prefixes from R2.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param bucketBinding The binding name of the bucket.
 * @param items An object containing arrays of keys and prefixes to delete.
 */
export const deleteObjects = async (workerUrl: string, bucketBinding: string, items: { keys: string[], prefixes: string[] }): Promise<void> => {
    await apiFetch(workerUrl, '/delete-objects', {
        method: 'POST',
        headers: { 'X-Bucket-Binding': bucketBinding },
        body: JSON.stringify(items),
    });
};

/**
 * Fetches all object keys under a list of prefixes.
 * @param workerUrl The full URL of the deployed Cloudflare worker.
 * @param bucketBinding The binding name of the bucket.
 * @param prefixes An array of prefixes to search.
 * @returns A promise that resolves to an array of all found object keys.
 */
export const listKeysForPrefixes = async (workerUrl: string, bucketBinding: string, prefixes: string[]): Promise<string[]> => {
    const response = await apiFetch(workerUrl, '/list-keys-for-prefixes', {
        method: 'POST',
        headers: { 'X-Bucket-Binding': bucketBinding },
        body: JSON.stringify({ prefixes }),
    });
    if (!response || !Array.isArray(response.keys)) {
        throw new Error("The API response for the key list is invalid.");
    }
    return response.keys;
};