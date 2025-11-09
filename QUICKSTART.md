# QuickStart Guide - QuickSync

Get your real-time shared clipboard up and running in 5 minutes.

## Step 1: Database Setup (Required)

Before the app will work, you need to create the database tables.

1. Go to https://app.supabase.com and log in
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS rooms (
  room_code text PRIMARY KEY,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  client_id text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(room_code, client_id)
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_rooms"
  ON rooms FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anyone_can_update_room_content"
  ON rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anyone_can_read_presence"
  ON room_presence FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anyone_can_insert_presence"
  ON room_presence FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "anyone_can_delete_presence"
  ON room_presence FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_room_presence_room_code ON room_presence(room_code);
```

6. Click **Run** or press Ctrl+Enter
7. Wait for success notification

**That's it!** Your database is ready.

## Step 2: Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Step 3: Try It Out

1. **Create a Room**: Click "Create New Room"
2. **Get the Code**: Note the 6-character code displayed
3. **Open Another Window**: Open the app in a new browser tab
4. **Join the Room**: Paste the room code and click "Join Room"
5. **Test Sync**: Type in one tab and watch it appear in the other instantly
6. **Check Presence**: See the active connection count update in the footer

## Step 4: Deploy

```bash
npm run build
```

The `dist/` folder is ready to deploy to any static hosting:

### Firebase Hosting
```bash
firebase deploy --only hosting
```

### Netlify
```bash
netlify deploy --prod --dir=dist
```

### Vercel
```bash
vercel deploy --prod
```

## What Just Happened?

- **HomePage**: Shows room creation and joining
- **RoomPage**: Shared text editor with real-time sync
- **Supabase**: Handles all data sync and presence tracking
- **Zero Setup**: No authentication needed, everything is public

## Troubleshooting

**"Room not found" when joining?**
- Make sure you entered the code correctly (6 characters)
- Room codes are case-insensitive but display as uppercase
- The room must have at least one active connection to exist

**Text not syncing?**
- Check browser console for errors (F12)
- Verify Supabase credentials in `.env`
- Make sure database tables were created

**Connection count not showing?**
- Refresh the page
- Check that `room_presence` table exists in Supabase

## Next Steps

- Customize styling in Tailwind config
- Add persistence (save rooms to database)
- Add user names/avatars
- Add message timestamps
- Deploy to production

Enjoy sharing!
