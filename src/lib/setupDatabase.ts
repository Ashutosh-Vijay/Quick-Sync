import { supabase } from './supabase';

export async function setupDatabase() {
  try {
    // Check if tables exist by trying to query them
    const { error: roomsError } = await supabase.from('rooms').select('count').limit(1);

    // If both tables exist, we're good
    if (!roomsError) {
      console.log('Database tables already exist');
      return true;
    }

    // Otherwise, try to create them
    console.log('Creating database tables...');

    // Note: Direct SQL execution via supabase client isn't available
    // The tables should be created via Supabase dashboard or migrations
    console.warn('Please ensure database tables are created via Supabase dashboard');

    return false;
  } catch (err) {
    console.error('Database setup error:', err);
    return false;
  }
}

export const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS rooms(
      room_code text PRIMARY KEY,
      content text DEFAULT '',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

      ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "anyone_can_read_rooms"
        ON rooms
        FOR SELECT
        TO anon, authenticated
    USING(true);

      CREATE POLICY "anyone_can_update_room_content"
        ON rooms
        FOR UPDATE
        TO anon, authenticated
    USING(true)
        WITH CHECK(true);


    `;
