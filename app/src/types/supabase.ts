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
      }
      artists: {
        Row: {
          id: string
          name: string
          tags: string[]
          tag_source: string
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
      }
    }
  }
}
