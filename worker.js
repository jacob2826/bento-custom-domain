addEventListener('fetch', event => {
  // When a fetch event occurs, responds with the result of the handleRequest function
  event.respondWith(handleRequest(event.request));
});

async function parseResponseByContentType(response, contentType) {
  // If there's no content type, the response is returned as text
  if (!contentType) return await response.text();

  // Depending on the content type, different actions are taken
  switch (true) {
    case contentType.includes('application/json'):
      // If the content type is JSON, the response is returned as a JSON string
      return JSON.stringify(await response.json());
    case contentType.includes('text/html'):
      // If the content type is HTML, the response is transformed using HTMLRewriter
      const transformedResponse = new HTMLRewriter()
        .on('body', {
          element(element) {
            // Custom CSS and JS can be added into the body of the HTML
            element.append(
              `
                <style>
                  // Custom CSS you can add to
                  // modify the styling of your page
                </style>
                `,
              { html: true },
            );
            element.append(
              `
                <script>
                  // Custom JS you can add to
                  // modify something on your page
                </script>
                `,
              { html: true },
            );
          },
        })
        .transform(response);
      // The transformed response is returned as text
      return await transformedResponse.text();

    case contentType.includes('font'):
      // If the content type is a font, the response is returned as an ArrayBuffer
      return await response.arrayBuffer();

    case contentType.includes('image'):
      // If the content type is an image, the response is returned as an ArrayBuffer
      return await response.arrayBuffer()

    default:
      // If the content type is anything else, the response is returned as text
      return await response.text();
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 基本的请求头部定义
  let headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  };

  // 检查是否是特定文件请求
  if (isDirectFileRequest(path)) {
    try {
      const object = await R2_BUCKET.get(path.substring(1)); // 去掉路径中的首个斜杠
      if (!object) {
        console.log("No object found in R2.");
        return new Response('File not found', { status: 404 });
      }

      console.log("Object found:", object);
      console.log("HTTP Metadata:", object.httpMetadata);

      const arrayBuffer = await object.arrayBuffer();
      const contentType = object.httpMetadata?.contentType || determineContentType(path);
      return new Response(arrayBuffer, {
        headers: { 'Content-Type': contentType }
      });
    } catch (error) {
      console.error("Error fetching file:", error);
      return new Response(`Error fetching file: ${error.message}`, { status: 500 });
    }
  }

  // 特殊处理 /v1/users/me
  if (path === '/v1/users/me') {
    const jsonBody = JSON.stringify({
      "status": 401,
      "code": "UNKNOWN_ERROR",
      "message": "Unauthorized"
    });
    return new Response(jsonBody, {
      headers: { 'content-type': 'application/json' },
      status: 401
    });
  }

  // 根目录重定向到个人页面
  if (path === '/') {
    const targetUrl = 'https://bento.me/' + BENTO_USERNAME;
    const response = await fetch(targetUrl, { headers });
    const contentType = response.headers.get('content-type');
    let results = await parseResponseByContentType(response, contentType);

    // 替换策略
    if (!(results instanceof ArrayBuffer)) {
      results = results.replaceAll('https://api.bento.me', BASE_URL); // 修正CORS问题
      results = results.replaceAll('pk.eyJ1IjoibXVnZWViIiwiYSI6ImNsdG5idzFrbTA0c3UycnA4OWRtbTJ6dmMifQ.Qa0vYWIbFEHuNuPpbVkdEQ', MAPBOX_TOKEN); // 替换mapbox的token，解决域名限制
      results = results.replaceAll('flex w-full flex-col items-center bg-[#FBFBFB]', 'hidden'); // 屏蔽底部登录元素
      results = results.replaceAll('fixed left-16 bottom-[52px] -m-1 hidden items-center space-x-1 rounded-[12px] p-1 transition-colors xl:flex 2xl:space-x-2', 'hidden'); // 屏蔽底部登录元素
    }

    headers['content-type'] = contentType;
    return new Response(results, { headers });
  }

  // 允许的资源路径检查
  const allowedPatterns = [
    '/v1', '/_next', '/images', '/_axiom'
  ];
  const isAllowed = allowedPatterns.some(pattern => path.startsWith(pattern));

  if (!isAllowed) {
    return new Response('Not Allowed', { status: 403 });
  }

  // 允许的资源路径，直接代理到 bento.me
  const targetUrl = 'https://bento.me' + path;
  const response = await fetch(targetUrl, { headers });
  const contentType = response.headers.get('content-type');
  let results = await parseResponseByContentType(response, contentType);

  // 替换策略
  if (!(results instanceof ArrayBuffer)) {
    results = results.replaceAll('https://api.bento.me', BASE_URL); // 修正CORS问题
    results = results.replaceAll('pk.eyJ1IjoibXVnZWViIiwiYSI6ImNsdG5idzFrbTA0c3UycnA4OWRtbTJ6dmMifQ.Qa0vYWIbFEHuNuPpbVkdEQ', MAPBOX_TOKEN); // 替换mapbox的token，解决域名限制
    results = results.replaceAll('flex w-full flex-col items-center bg-[#FBFBFB]', 'hidden'); // 屏蔽底部登录元素
    results = results.replaceAll('fixed left-16 bottom-[52px] -m-1 hidden items-center space-x-1 rounded-[12px] p-1 transition-colors xl:flex 2xl:space-x-2', 'hidden'); // 屏蔽底部登录元素
  }

  headers['content-type'] = contentType;
  return new Response(results, { headers });
}

function isDirectFileRequest(path) {
  // 定义允许的直接文件请求路径
  const directFileRules = [
    '/favicon.ico',
    '/site.webmanifest',
    /^\/[^\/]+\.png$/  // 匹配根目录下的任意.png文件
  ];

  return directFileRules.some(rule => {
    if (typeof rule === 'string') {
      return path === rule;
    } else if (rule instanceof RegExp) {
      return rule.test(path);
    }
  });
}

function determineContentType(path) {
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.webmanifest')) return 'application/manifest+json';
  if (path.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
