interface Env {
  R2_FILES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env, 'room' | 'id'> = async ({ params, env }) => {
  const room = String(params.room);
  const id = String(params.id);

  if (!/^[A-Z0-9]{4,12}$/i.test(room) || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    return new Response('Bad request', { status: 400 });
  }

  const obj = await env.R2_FILES.get(`${room}/${id}`);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
};
