# QuickSync Database Setup

This application requires setting up two tables in Supabase. Follow these steps:

## Step 1: Access Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Click on "SQL Editor" in the left sidebar

## Step 2: Create the Tables

Copy and paste the following SQL into the SQL Editor and execute it:

```sql
-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  room_code text PRIMARY KEY,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create room_presence table
CREATE TABLE IF NOT EXISTS room_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  client_id text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(room_code, client_id)
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_presence ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rooms
CREATE POLICY "anyone_can_read_rooms"
  ON rooms
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anyone_can_update_room_content"
  ON rooms
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for room_presence
CREATE POLICY "anyone_can_read_presence"
  ON room_presence
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anyone_can_insert_presence"
  ON room_presence
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anyone_can_delete_presence"
  ON room_presence
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_room_presence_room_code ON room_presence(room_code);
```

## What These Tables Do

### rooms
- `room_code`: Unique 6-character room identifier (PRIMARY KEY)
- `content`: Shared text content that syncs across all clients
- `created_at`: When the room was created
- `updated_at`: When content was last modified

### room_presence
- `id`: Unique identifier for each presence entry
- `room_code`: References the room
- `client_id`: Unique session identifier for connected users
- `connected_at`: When the user connected
- Composite unique constraint ensures only one presence entry per client per room

## RLS Policies

All policies allow public read/write access because this is a shared clipboard app where all users in a room should be able to see and modify content. This is intentional.

## After Setup

The application should work immediately. You can now:
1. Create rooms that generate 6-character codes
2. Join existing rooms with the code
3. Share text in real-time
4. See live connection counts
