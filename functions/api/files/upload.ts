const SUPABASE_DIRECT_URL = 'https://lfchewptxtdyzfkstiun.supabase.co';

interface Env {
  R2_FILES: R2Bucket;
  VITE_SUPABASE_ANON_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get('room');
  const fileId = url.searchParams.get('id');

  if (!roomCode || !fileId) {
    return new Response('Missing room or id', { status: 400 });
  }
  if (!/^[A-Z0-9]{4,12}$/i.test(roomCode)) {
    return new Response('Invalid room code', { status: 400 });
  }
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(fileId)) {
    return new Response('Invalid file id', { status: 400 });
  }
  if (!request.body) {
    return new Response('Empty body', { status: 400 });
  }

  const roomRes = await fetch(
    `${SUPABASE_DIRECT_URL}/rest/v1/rooms?room_code=eq.${encodeURIComponent(roomCode)}&select=room_code`,
    {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!roomRes.ok) {
    return new Response('Room lookup failed', { status: 502 });
  }
  const rooms = (await roomRes.json()) as Array<{ room_code: string }>;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return new Response('Room not found', { status: 404 });
  }

  const key = `${roomCode}/${fileId}`;
  await env.R2_FILES.put(key, request.body, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  return Response.json({
    key,
    url: `/api/files/get/${roomCode}/${fileId}`,
  });
};
