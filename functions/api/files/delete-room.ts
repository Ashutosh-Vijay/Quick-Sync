interface Env {
  R2_FILES: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as { room?: string };
  const { room } = body;
  if (!room) return new Response('Bad request', { status: 400 });
  if (!/^[A-Z0-9]{4,12}$/i.test(room)) return new Response('Bad request', { status: 400 });

  let cursor: string | undefined;
  let totalDeleted = 0;
  do {
    const list = await env.R2_FILES.list({ prefix: `${room}/`, cursor });
    const keys = list.objects.map((o) => o.key);
    if (keys.length > 0) {
      await env.R2_FILES.delete(keys);
      totalDeleted += keys.length;
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return Response.json({ deleted: totalDeleted });
};
