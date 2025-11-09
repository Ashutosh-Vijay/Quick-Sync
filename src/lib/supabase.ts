import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Room = {
  room_code: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Presence = {
  id: string;
  room_code: string;
  client_id: string;
  connected_at: string;
};
