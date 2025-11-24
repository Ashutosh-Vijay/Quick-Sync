export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          room_code: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          room_code: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          room_code?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_presence: {
        Row: {
          id: string;
          room_code: string;
          client_id: string;
          connected_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          client_id: string;
          connected_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          client_id?: string;
          connected_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'room_presence_room_code_fkey';
            columns: ['room_code'];
            referencedRelation: 'rooms';
            referencedColumns: ['room_code'];
          },
        ];
      };
      room_files: {
        Row: {
          id: string;
          room_code: string;
          file_data: string; // The single blob payload
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          file_data: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          file_data?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'room_files_room_code_fkey';
            columns: ['room_code'];
            referencedRelation: 'rooms';
            referencedColumns: ['room_code'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
