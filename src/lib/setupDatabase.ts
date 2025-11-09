import { supabase } from './supabase';

export async function setupDatabase() {
  try {
    // Check if tables exist by trying to query them
    const { error: roomsError } = await supabase
      .from('rooms')
      .select('count')
      .limit(1);

    const { error: presenceError } = await supabase
      .from('room_presence')
      .select('count')
      .limit(1);

    // If both tables exist, we're good
    if (!roomsError && !presenceError) {
      console.log('Database tables already exist');
      return true;
    }

    // Otherwise, try to create them
    console.log('Creating database tables...');

    const createTablesSQL = `
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

      CREATE INDEX IF NOT EXISTS idx_room_presence_room_code ON room_presence(room_code);
    `;

    // Note: Direct SQL execution via supabase client isn't available
    // The tables should be created via Supabase dashboard or migrations
    console.warn('Please ensure database tables are created via Supabase dashboard');

    return false;
  } catch (err) {
    console.error('Database setup error:', err);
    return false;
  }
}
