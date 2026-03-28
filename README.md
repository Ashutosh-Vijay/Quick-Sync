# Quick Sync

Real-time text and file sync across devices. No accounts, no installs — just a room code.

## What it does

- **Text sync** — shared textarea that syncs across all connected devices in real time (differential patches, not full content on every keystroke)
- **File sharing** — upload files, others can download them; files persist until the room is destructed
- **Encryption** — rooms created with a passphrase use AES-256-GCM (Web Crypto API) end-to-end; public rooms use obfuscation only
- **Room destruct** — nuke the room, all content, and all uploaded files from storage in one click; all connected clients are notified instantly
- **Undo/redo** — local history stack per session
- **Drag-and-drop uploads**

## Stack

| Layer    | Tech                                             |
| -------- | ------------------------------------------------ |
| Frontend | Vite + React 18 + TypeScript                     |
| Styling  | Tailwind CSS + shadcn/ui                         |
| State    | Zustand                                          |
| Realtime | Supabase Realtime (broadcast + postgres_changes) |
| Storage  | Supabase Storage                                 |
| Crypto   | Web Crypto API — AES-256-GCM                     |
| Deploy   | Cloudflare Pages                                 |

## Self-hosting

### 1. Supabase setup

Create a project at [supabase.com](https://supabase.com), then run in the SQL Editor:

```sql
-- Rooms
CREATE TABLE rooms (
  room_code text PRIMARY KEY,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Files
CREATE TABLE room_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  file_data text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Enable RLS (all policies allow public access — intentional for a shared tool)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_rooms" ON rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_files" ON room_files FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

Create a **Storage bucket** named `quick-share` (public bucket). Add a DELETE policy on `storage.objects` so files can be removed:

```sql
CREATE POLICY "allow_storage_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'quick-share');
```

### 2. Environment

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run

```bash
npm install
npm run dev
```

## License

MIT
