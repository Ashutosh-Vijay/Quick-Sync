const SUPABASE_HTTP = 'https://lfchewptxtdyzfkstiun.supabase.co';
const SUPABASE_WS = 'wss://lfchewptxtdyzfkstiun.supabase.co';

export const onRequest: PagesFunction<unknown, 'path'> = async ({ request, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const path = segments.join('/');
  const url = new URL(request.url);
  const tail = `/${path}${url.search}`;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const upgrade = request.headers.get('Upgrade');
  if (upgrade && upgrade.toLowerCase() === 'websocket') {
    return fetch(`${SUPABASE_WS}${tail}`, request);
  }

  const targetUrl = `${SUPABASE_HTTP}${tail}`;
  const proxied = await fetch(
    new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
  );

  const out = new Response(proxied.body, proxied);
  out.headers.set('Access-Control-Allow-Origin', '*');
  out.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  out.headers.set('Access-Control-Allow-Headers', '*');
  return out;
};
