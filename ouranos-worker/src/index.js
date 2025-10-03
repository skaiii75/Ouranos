// En-têtes pour la gestion du CORS (Cross-Origin Resource Sharing)
const corsHeaders = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  // IMPORTANT: Pour la production, remplacez '*' par le domaine de votre application web.
  'Access-Control-Allow-Origin': '*',
};

/**
 * Gère les requêtes "pre-flight" OPTIONS pour le CORS.
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
    // Répondre aux requêtes OPTIONS pour le CORS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === '/buckets') {
        return await handleListBindings(request, env);
      }
      if (url.pathname === '/upload-file') {
        return await handleUploadFile(request, env);
      }
      if (url.pathname === '/list-cf-buckets') {
        return await handleListCfBuckets(request, env);
      }
      if (url.pathname === '/list-folders') {
        return await handleListFolders(request, env);
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
  },
};

/**
 * Gère l'endpoint /buckets
 * Identifie et retourne les liaisons R2 disponibles dans l'environnement du worker.
 */
async function handleListBindings(request, env) {
  const allKeys = Object.keys(env);
  const buckets = [];
  const debug_env_keys = [];

  for (const key of allKeys) {
    const binding = env[key];
    // Vérification simplifiée : si l'objet possède les méthodes `get` et `put`,
    // on le considère comme un bucket R2. Cela contourne les problèmes liés à `createPresignedUrl`.
    if (binding && typeof binding.get === 'function' && typeof binding.put === 'function') {
      buckets.push(key);
    } else {
      debug_env_keys.push(key);
    }
  }

  const responseBody = {
    buckets: buckets.sort(),
    version: "1.4.0", // Version
    debug_env_keys: debug_env_keys.sort(),
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Gère l'endpoint /upload-file
 * Reçoit un fichier directement du client et le téléverse sur R2 via un stream.
 */
async function handleUploadFile(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucketBinding = request.headers.get('x-bucket-binding');
  const objectKeyHeader = request.headers.get('x-object-key');
  const contentType = request.headers.get('content-type');

  if (!bucketBinding || !objectKeyHeader) {
    return new Response(JSON.stringify({ error: 'En-têtes requis manquants: x-bucket-binding et x-object-key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const objectKey = decodeURIComponent(objectKeyHeader);

  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `La liaison '${bucketBinding}' est introuvable ou n'est pas un bucket R2.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!request.body) {
      return new Response(JSON.stringify({ error: 'Le corps de la requête est vide.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Le corps de la requête (le fichier) est directement streamé vers R2.
  // C'est une méthode très efficace pour gérer les téléversements.
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
 * Gère l'endpoint /list-cf-buckets
 * Agit comme un proxy sécurisé vers l'API Cloudflare pour lister les buckets d'un compte.
 */
async function handleListCfBuckets(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const { accountId, apiToken } = body;

    if (!accountId || !apiToken) {
      return new Response(JSON.stringify({ error: "L'ID de compte et le jeton d'API sont requis." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      const errorMessage = cfData.errors?.[0]?.message || 'Erreur lors de la communication avec l\'API Cloudflare.';
      const errorCode = cfData.errors?.[0]?.code || cfResponse.status;
      
      let friendlyError = `Erreur API Cloudflare : ${errorMessage}`;
      if (errorCode === 10000 || errorCode === 9109) {
        friendlyError = "Erreur d'authentification. Veuillez vérifier que votre Jeton d'API est correct, actif, et possède la permission 'R2:Read'.";
      } else if (String(errorCode).startsWith('7')) {
        friendlyError = "L'ID de Compte Cloudflare est incorrect ou n'a pas été trouvé.";
      }

      return new Response(JSON.stringify({ error: friendlyError }), { status: cfResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const buckets = cfData.result?.buckets || [];
    return new Response(JSON.stringify({ buckets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    if (e instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Le corps de la requête est invalide (JSON malformé).' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Re-throw other errors to be handled by the main fetch handler
    throw e;
  }
}

/**
 * Gère l'endpoint /list-folders
 * Liste TOUS les "dossiers" (préfixes) dans un bucket R2, y compris les dossiers imbriqués.
 */
async function handleListFolders(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucketBinding = request.headers.get('x-bucket-binding');

  if (!bucketBinding) {
    return new Response(JSON.stringify({ error: 'En-tête requis manquant: x-bucket-binding' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const bucket = env[bucketBinding];
  if (!bucket) {
    return new Response(JSON.stringify({ error: `La liaison '${bucketBinding}' est introuvable ou n'est pas un bucket R2.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const folderPaths = new Set();
  let cursor = undefined;

  // Gérer la pagination de l'API R2
  while (true) {
    const listResult = await bucket.list({ cursor });

    for (const object of listResult.objects) {
      const key = object.key;
      // Si la clé contient un '/', c'est qu'elle est dans un dossier.
      if (key.includes('/')) {
        // Extraire toutes les parties du chemin. Ex: "a/b/c.txt" -> "a/", "a/b/"
        const parts = key.split('/');
        // On ignore le dernier élément qui est le nom du fichier.
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath += parts[i] + '/';
          folderPaths.add(currentPath);
        }
      }
    }
    
    // Si truncated est faux, nous avons listé tous les objets.
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