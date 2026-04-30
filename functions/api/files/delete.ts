interface Env {
  R2_FILES: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as { room?: string; id?: string };
  const { room, id } = body;
  if (!room || !id) return new Response('Bad request', { status: 400 });
  if (!/^[A-Z0-9]{4,12}$/i.test(room) || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    return new Response('Bad request', { status: 400 });
  }
  await env.R2_FILES.delete(`${room}/${id}`);
  return Response.json({ ok: true });
};
