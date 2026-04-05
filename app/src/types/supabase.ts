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
          blurb: string | null
          decade: string | null
          related_artists: string[] | null
          youtube_channel_id: string | null
          musicbrainz_id: string | null
          is_curated: boolean
          discovered_by: string | null
          created_at: string
          last_refreshed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          tags?: string[]
          tag_source?: string
          blurb?: string | null
          decade?: string | null
          related_artists?: string[] | null
          youtube_channel_id?: string | null
          musicbrainz_id?: string | null
          is_curated?: boolean
          discovered_by?: string | null
          created_at?: string
          last_refreshed_at?: string | null
        }
        Update: {
          name?: string
          tags?: string[]
          tag_source?: string
          blurb?: string | null
          decade?: string | null
          related_artists?: string[] | null
          youtube_channel_id?: string | null
          musicbrainz_id?: string | null
          is_curated?: boolean
          last_refreshed_at?: string | null
        }
        Relationships: []
      }
      artist_videos: {
        Row: {
          id: string
          artist_id: string
          youtube_video_id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          published_at: string | null
          view_count: number | null
          search_query: string
          is_manually_added: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          youtube_video_id: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          published_at?: string | null
          view_count?: number | null
          search_query: string
          is_manually_added?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          published_at?: string | null
          view_count?: number | null
          display_order?: number
          is_manually_added?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "artist_videos_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_searches: {
        Row: {
          id: string
          user_id: string
          query_text: string
          selected_artist_id: string | null
          was_cache_hit: boolean
          searched_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query_text: string
          selected_artist_id?: string | null
          was_cache_hit?: boolean
          searched_at?: string
        }
        Update: {
          query_text?: string
          selected_artist_id?: string | null
          was_cache_hit?: boolean
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
