export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          is_anonymous: boolean
          display_name: string | null
          created_at: string
          last_seen_at: string
        }
        Insert: {
          id: string
          is_anonymous?: boolean
          display_name?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Update: {
          is_anonymous?: boolean
          display_name?: string | null
          last_seen_at?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          id: string
          name: string
          tags: string[] | null
          tag_source: string | null
          youtube_channel_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          tags?: string[]
          tag_source?: string
          youtube_channel_id?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          tags?: string[]
          tag_source?: string
          youtube_channel_id?: string | null
        }
        Relationships: []
      }
      artist_searches: {
        Row: {
          id: string
          user_id: string
          query_text: string
          selected_artist_id: string | null
          searched_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query_text: string
          selected_artist_id?: string | null
          searched_at?: string
        }
        Update: {
          query_text?: string
          selected_artist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_searches_selected_artist_id_fkey"
            columns: ["selected_artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          id: string
          user_id: string
          artist_id: string
          youtube_video_id: string
          video_title: string
          watched_at: string
          watch_duration_seconds: number | null
        }
        Insert: {
          id?: string
          user_id: string
          artist_id: string
          youtube_video_id: string
          video_title: string
          watched_at?: string
          watch_duration_seconds?: number | null
        }
        Update: {
          watch_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}
