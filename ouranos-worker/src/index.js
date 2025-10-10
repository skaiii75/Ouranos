// Headers for CORS (Cross-Origin Resource Sharing) management
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  // IMPORTANT: For production, replace '*' with your web application's domain.
  'Access-Control-Allow-Origin': '*',
};

/**
 * Handles "pre-flight" OPTIONS requests for CORS.
 */
async function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    return new Response(null, { headers: corsHeaders });
  } else {
    return new Response(null, {
      headers: { Allow: 'GET, POST, OPTIONS' },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    // Respond to OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname.endsWith('/buckets')) {
        return await handleListBindings(request, env);
      }
      if (url.pathname.endsWith('/upload-file')) {
        return await handleUploadFile(request, env);
      }
      if (url.pathname.endsWith('/list-cf-buckets')) {
        return await handleListCfBuckets(request, env);
      }
      if (url.pathname.endsWith('/list-objects')) {
        return await handleListObjects(request, env);
      }
      if (url.pathname.endsWith('/list-folders')) {
        return await handleListFolders(request, env);
      }
      if (url.pathname.endsWith('/delete-objects')) {
        return await handleDeleteObjects(request, env);
      }
      if (url.pathname.endsWith('/list-keys-for-prefixes')) {
        return await handleListKeysForPrefixes(request, env);
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
  },
};

/**
 * Handles the /buckets endpoint
 * Identifies and returns the available R2 bindings in the worker's environment.
 */
async function handleListBindings(request, env) {
  const allKeys = Object.keys(env);
  const buckets = [];
  const debug_env_keys = [];

  for (const key of allKeys) {
    const binding = env[key];
    // Simplified check: if the object has 'get' and 'put' methods,
    // we consider it an R2 bucket. This bypasses issues related to `createPresignedUrl`.
    if (binding && typeof binding.get === 'function' && typeof binding.put === 'function') {
      buckets.push(key);
    } else {
      debug_env_keys.push(key);
    }
  }

  const responseBody = {
    buckets: buckets.sort(),
    version: "1.5.0", // Version
    debug_env_keys: debug_env_keys.sort(),
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handles the /upload-file endpoint
 * Receives a file directly from the client and uploads it to R2 via a stream.
 */
async function handleUploadFile(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucketBinding = request.headers.get('x-bucket-binding');
  const objectKeyHeader = request.headers.get('x-object-key');
  const contentType = request.headers.get('content-type');

  if (!bucketBinding || !objectKeyHeader) {
    return new Response(JSON.stringify({ error: 'Missing required headers: x-bucket-binding and x-object-key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const objectKey = decodeURIComponent(objectKeyHeader);

  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Binding '${bucketBinding}' not found or is not an R2 bucket.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is empty.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // The request body (the file) is streamed directly to R2.
  // This is a very efficient method for handling uploads.
  await bucket.put(objectKey, request.body, {
    httpMetadata: {
      contentType: contentType || 'application/octet-stream',
    },
  });

  return new Response(JSON.stringify({ success: true, key: objectKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}


/**
 * Handles the /list-cf-buckets endpoint
 * Acts as a secure proxy to the Cloudflare API to list an account's buckets.
 */
async function handleListCfBuckets(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const { accountId, apiToken } = body;

    if (!accountId || !apiToken) {
      return new Response(JSON.stringify({ error: "Account ID and API Token are required." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;

    // Proxy the request to the Cloudflare API
    const cfResponse = await fetch(cfApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok || !cfData.success) {
      const errorMessage = cfData.errors?.[0]?.message || 'Error communicating with the Cloudflare API.';
      const errorCode = cfData.errors?.[0]?.code || cfResponse.status;
      
      let friendlyError = `Cloudflare API Error: ${errorMessage}`;
      if (errorCode === 10000 || errorCode === 9109) {
        friendlyError = "Authentication error. Please verify that your API Token is correct, active, and has the 'R2:Read' permission.";
      } else if (String(errorCode).startsWith('7')) {
        friendlyError = "The Cloudflare Account ID is incorrect or was not found.";
      }

      return new Response(JSON.stringify({ error: friendlyError }), { status: cfResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const buckets = cfData.result?.buckets || [];
    return new Response(JSON.stringify({ buckets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    if (e instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Request body is invalid (malformed JSON).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Re-throw other errors to be handled by the main fetch handler
    throw e;
  }
}

/**
 * Handles the /list-objects endpoint
 * Lists objects (files) and folders for a given prefix in an R2 bucket.
 */
async function handleListObjects(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucketBinding = request.headers.get('x-bucket-binding');
  const prefix = request.headers.get('x-prefix') || '';
  const cursor = request.headers.get('x-cursor') || undefined;

  if (!bucketBinding) {
    return new Response(JSON.stringify({ error: 'Missing required header: x-bucket-binding' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Binding '${bucketBinding}' not found or is not an R2 bucket.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const listOptions = {
    prefix: prefix,
    cursor: cursor,
    limit: 100,
    delimiter: '/', // To separate files from folders
    include: ['httpMetadata'],
  };

  const listResult = await bucket.list(listOptions);

  const responseBody = {
    objects: listResult.objects,
    delimitedPrefixes: listResult.delimitedPrefixes,
    cursor: listResult.truncated ? listResult.cursor : undefined,
    truncated: listResult.truncated,
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handles the /list-folders endpoint
 * Lists ALL "folders" (prefixes) in an R2 bucket, including nested folders.
 */
async function handleListFolders(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucketBinding = request.headers.get('x-bucket-binding');

  if (!bucketBinding) {
    return new Response(JSON.stringify({ error: 'Missing required header: x-bucket-binding' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Binding '${bucketBinding}' not found or is not an R2 bucket.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const folderPaths = new Set();
  let cursor = undefined;

  // Handle R2 API pagination
  while (true) {
    const listResult = await bucket.list({ cursor });

    for (const object of listResult.objects) {
      const key = object.key;
      // If the key contains a '/', it's in a folder.
      if (key.includes('/')) {
        // Extract all parts of the path. Ex: "a/b/c.txt" -> "a/", "a/b/"
        const parts = key.split('/');
        // We ignore the last element, which is the filename.
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath += parts[i] + '/';
          folderPaths.add(currentPath);
        }
      }
    }
    
    // If truncated is false, we have listed all objects.
    if (!listResult.truncated) {
      break;
    }
    cursor = listResult.cursor;
  }

  const folders = Array.from(folderPaths).sort();

  return new Response(JSON.stringify({ folders }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handles the /delete-objects endpoint
 * Bulk deletes files and/or folders (prefixes).
 */
async function handleDeleteObjects(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }
  const bucketBinding = request.headers.get('x-bucket-binding');
  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Binding '${bucketBinding}' not found.` }), { status: 400 });
  }

  const { keys = [], prefixes = [] } = await request.json();
  const allKeysToDelete = new Set(keys);

  for (const prefix of prefixes) {
    let cursor = undefined;
    while (true) {
      const listResult = await bucket.list({ prefix, cursor });
      listResult.objects.forEach(obj => allKeysToDelete.add(obj.key));
      if (!listResult.truncated) break;
      cursor = listResult.cursor;
    }
  }

  const keysArray = Array.from(allKeysToDelete);
  for (let i = 0; i < keysArray.length; i += 1000) {
    const batch = keysArray.slice(i, i + 1000);
    await bucket.delete(batch);
  }

  return new Response(JSON.stringify({ success: true, deletedCount: keysArray.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handles the /list-keys-for-prefixes endpoint
 * Recursively fetches all object keys under the given prefixes.
 */
async function handleListKeysForPrefixes(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }
  const bucketBinding = request.headers.get('x-bucket-binding');
  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `Binding '${bucketBinding}' not found.` }), { status: 400 });
  }
  
  const { prefixes = [] } = await request.json();
  const allKeys = [];

  for (const prefix of prefixes) {
    let cursor = undefined;
    while (true) {
      const listResult = await bucket.list({ prefix, cursor });
      listResult.objects.forEach(obj => allKeys.push(obj.key));
      if (!listResult.truncated) break;
      cursor = listResult.cursor;
    }
  }

  return new Response(JSON.stringify({ keys: allKeys }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}