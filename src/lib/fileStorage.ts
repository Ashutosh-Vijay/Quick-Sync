import { supabase } from '@/lib/supabase';

const R2_URL_MARKER = '/api/files/get/';
const SUPABASE_PATH_MARKER = '/quick-share/';

function isR2Url(url: string): boolean {
  return url.includes(R2_URL_MARKER);
}

function parseR2Key(url: string): { room: string; id: string } | null {
  const idx = url.indexOf(R2_URL_MARKER);
  if (idx === -1) return null;
  const tail = url.slice(idx + R2_URL_MARKER.length).split('?')[0];
  const [room, id] = tail.split('/');
  if (!room || !id) return null;
  return { room, id };
}

function parseSupabasePath(url: string): string | null {
  const idx = url.indexOf(SUPABASE_PATH_MARKER);
  return idx === -1 ? null : url.slice(idx + SUPABASE_PATH_MARKER.length);
}

export async function deleteFileByUrl(url: string): Promise<void> {
  if (isR2Url(url)) {
    const parsed = parseR2Key(url);
    if (!parsed) return;
    await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    return;
  }
  const path = parseSupabasePath(url);
  if (path) {
    await supabase.storage.from('quick-share').remove([path]);
  }
}

export async function deleteAllRoomFiles(roomCode: string): Promise<void> {
  await fetch('/api/files/delete-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: roomCode }),
  }).catch(() => {});

  const { data: folders } = await supabase.storage.from('quick-share').list(roomCode);
  if (!folders || folders.length === 0) return;
  const paths: string[] = [];
  for (const folder of folders) {
    const { data: storageFiles } = await supabase.storage
      .from('quick-share')
      .list(`${roomCode}/${folder.name}`);
    (storageFiles ?? []).forEach((f) => paths.push(`${roomCode}/${folder.name}/${f.name}`));
  }
  if (paths.length > 0) {
    await supabase.storage.from('quick-share').remove(paths);
  }
}
