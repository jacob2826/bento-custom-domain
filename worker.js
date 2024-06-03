addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

addEventListener('scheduled', event => {
  event.waitUntil(handleScheduled(event));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 目录保护逻辑
  if (!isValidPath(path, request.method)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (path === '/cleanup' && request.method === 'POST') {
    return await cleanupR2Bucket();
  }

  const referer = request.headers.get("referer") || '';
  let headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  };

  if (isStaticResourceRequest(path)) {
    const fileResponse = await fetchFromR2(path);
    if (fileResponse) {
      console.log(`File ${path} served from R2`);
      return applyReplacementsToResponse(fileResponse, headers);
    } else {
      const originUrl = determineOriginUrl(path, referer);
      if (!originUrl) {
        return new Response('Unauthorized access', { status: 403 });
      }
      const fetchedResponse = await fetchAndStoreFile(path, headers, originUrl);
      console.log(`File ${path} served from origin via reverse proxy`);
      return applyReplacementsToResponse(fetchedResponse, headers);
    }
  }

  let targetUrl = determineOriginUrl(path, referer);
  if (!targetUrl) {
    return new Response('Unauthorized access', { status: 403 });
  }

  const response = await fetch(targetUrl, { headers });
  const contentType = response.headers.get('content-type');
  let results = await parseResponseByContentType(response, contentType);

  if (contentType.includes('text/') || contentType.includes('application/json') || contentType.includes('application/javascript')) {
    results = applyReplacements(results);
  }

  headers['content-type'] = contentType;
  return new Response(results, { headers });
}

async function handleScheduled(event) {
  return await cleanupR2Bucket();
}

async function parseResponseByContentType(response, contentType) {
  if (!contentType) return await response.text();

  switch (true) {
    case contentType.includes('application/json'):
      let jsonResponse = await response.json();
      return JSON.stringify(jsonResponse);
    case contentType.includes('text/html'):
      let htmlResponse = await response.text();
      return new HTMLRewriter()
        .on('body', {
          element(element) {
            element.append(`
                <style>// Custom CSS</style>`, { html: true });
            element.append(`
                <script>// Custom JS</script>`, { html: true });
          },
        })
        .transform(new Response(htmlResponse, { headers: { 'content-type': 'text/html' } }))
        .text();
    case contentType.includes('javascript') || contentType.includes('application/javascript') || contentType.includes('text/javascript'):
      return await response.text();
    case contentType.includes('text/css'):
      return await response.text();
    case contentType.includes('font') || contentType.includes('image'):
      return response.arrayBuffer();
    default:
      return await response.text();
  }
}

function isStaticResourceRequest(path) {
  return path.match(/\.(jpg|jpeg|png|gif|webp|ico|webmanifest|js|css)$/i);
}

function isValidPath(path, method) {
  const allowedGetPaths = ['/_next', '/_axiom', '/googleapis_storage', '/api', '/images'];
  const allowedPostPaths = ['/cleanup', '/api'];

  if (method === 'GET') {
    // Allow exact root path for static files only
    if (path === '/' || (path.startsWith('/') && isStaticResourceRequest(path) && !path.includes('/', 1))) {
      return true;
    }
    // Allow specific paths and their sub-paths
    return allowedGetPaths.some(allowedPath => path === allowedPath || (path.startsWith(allowedPath) && path[allowedPath.length] === '/'));
  }

  if (method === 'POST') {
    return allowedPostPaths.includes(path);
  }

  return false;
}

function determineOriginUrl(path, referer) {
  if ((path.startsWith('/api') || path.startsWith('/googleapis_storage')) && !referer.startsWith(BASE_URL)) {
    return null;
  }
  if (path.startsWith('/api')) {
    return `https://api.bento.me${path.substring(4)}`;
  } else if (path.startsWith('/googleapis_storage')) {
    return `https://storage.googleapis.com${path.substring(19)}`;
  } else if (path === '/') {
    return `https://bento.me/${BENTO_USERNAME}`;
  } else {
    return `https://bento.me${path}`;
  }
}

async function fetchFromR2(path) {
  try {
    const object = await R2_BUCKET.get(path.substring(1));
    if (!object) {
      return null;
    }
    const arrayBuffer = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || determineContentType(path);
    return new Response(arrayBuffer, { headers: { 'Content-Type': contentType } });
  } catch (error) {
    console.error("Error fetching from R2:", error);
    return null;
  }
}

async function fetchAndStoreFile(path, headers, originUrl) {
  const response = await fetch(originUrl, { headers });
  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    try {
      await R2_BUCKET.put(path.substring(1), arrayBuffer, {
        httpMetadata: {
          contentType: response.headers.get('content-type')
        }
      });
    } catch (error) {
      console.error("Error storing file to R2:", error);
    }
    return new Response(arrayBuffer, {
      headers: { 'Content-Type': response.headers.get('content-type') }
    });
  } else {
    return response; // Directly return the response if there is an error
  }
}

function applyReplacements(text) {
  text = text.replaceAll('https://api.bento.me', `${BASE_URL}/api`);
  text = text.replaceAll('https://storage.googleapis.com', `${BASE_URL}/googleapis_storage`);
  text = text.replaceAll('pk.eyJ1IjoibXVnZWViIiwiYSI6ImNsdG5idzFrbTA0c3UycnA4OWRtbTJ6dmMifQ.Qa0vYWIbFEHuNuPpbVkdEQ', MAPBOX_TOKEN);
  text = text.replaceAll('flex w-full flex-col items-center bg-[#FBFBFB]', 'hidden');
  text = text.replaceAll('fixed left-16 bottom-[52px] -m-1 hidden items-center space-x-1 rounded-[12px] p-1 transition-colors xl:flex 2xl:space-x-2', 'hidden');
  return text;
}

async function applyReplacementsToResponse(response, headers) {
  const contentType = response.headers.get('Content-Type');
  if (contentType.includes('text/') || contentType.includes('application/json') || contentType.includes('application/javascript')) {
    const textResponse = await response.text();
    const replacedText = applyReplacements(textResponse);
    return new Response(replacedText, { headers: { ...headers, 'Content-Type': contentType } });
  }
  return response;
}

function determineContentType(path) {
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.webmanifest')) return 'application/manifest+json';
  if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif') || path.endsWith('.webp')) return 'image/png'; // Example, should be specific
  return 'application/octet-stream';
}

async function cleanupR2Bucket() {
  const retentionPeriod = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
  const currentTime = Date.now();

  let cursor;
  do {
    const listResponse = await R2_BUCKET.list({ cursor });
    const keysToDelete = [];

    for (const object of listResponse.objects) {
      const lastModified = new Date(object.uploaded).getTime();
      if (object.key !== '' && (currentTime - lastModified) > retentionPeriod) {
        keysToDelete.push(object.key);
      }
    }

    if (keysToDelete.length > 0) {
      await R2_BUCKET.delete(keysToDelete);
    }

    cursor = listResponse.cursor;
  } while (cursor);

  return new Response('Cleanup completed', { status: 200 });
}
