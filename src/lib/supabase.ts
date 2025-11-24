import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check: Log error but don't crash the module loader immediately
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '🚨 CRITICAL ERROR: Supabase environment variables are missing! Check your .env file.'
  );
}

// ✅ Enterprise Grade: Fully typed client with Realtime configuration
// We fallback to empty strings to ensure the 'supabase' export always exists,
// preventing "does not provide an export" errors even if config is broken.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Helper types derived from the Database definition
export type Room = Database['public']['Tables']['rooms']['Row'];
export type Presence = Database['public']['Tables']['room_presence']['Row'];
