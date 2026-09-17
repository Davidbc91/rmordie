export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          bar_weights: Json
          id: string
          plate_weights: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bar_weights?: Json
          id?: string
          plate_weights?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bar_weights?: Json
          id?: string
          plate_weights?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_goals: {
        Row: {
          created_at: string
          current_value: number | null
          exercise: string | null
          goal_type: string
          id: string
          start_value: number | null
          status: string
          target_date: string | null
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          exercise?: string | null
          goal_type?: string
          id?: string
          start_value?: number | null
          status?: string
          target_date?: string | null
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          exercise?: string | null
          goal_type?: string
          id?: string
          start_value?: number | null
          status?: string
          target_date?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profile: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          box_name: string | null
          created_at: string
          crossfit_start_date: string | null
          current_weight_kg: number | null
          display_name: string | null
          goals: Json
          height_cm: number | null
          id: string
          level: string | null
          sex: string | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weekly_target: number | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          box_name?: string | null
          created_at?: string
          crossfit_start_date?: string | null
          current_weight_kg?: number | null
          display_name?: string | null
          goals?: Json
          height_cm?: number | null
          id?: string
          level?: string | null
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weekly_target?: number | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          box_name?: string | null
          created_at?: string
          crossfit_start_date?: string | null
          current_weight_kg?: number | null
          display_name?: string | null
          goals?: Json
          height_cm?: number | null
          id?: string
          level?: string | null
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weekly_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profile_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          arm_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measured_on: string
          muscle_mass_kg: number | null
          notes: string | null
          thigh_cm: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_cm?: number | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_log: {
        Row: {
          block_key: string | null
          created_at: string
          day_key: string | null
          exercise: string
          id: string
          is_pr: boolean
          month_key: string | null
          notes: string | null
          performed_on: string
          reps: number | null
          time_seconds: number | null
          user_id: string
          week: number | null
          weight: number | null
        }
        Insert: {
          block_key?: string | null
          created_at?: string
          day_key?: string | null
          exercise: string
          id?: string
          is_pr?: boolean
          month_key?: string | null
          notes?: string | null
          performed_on?: string
          reps?: number | null
          time_seconds?: number | null
          user_id: string
          week?: number | null
          weight?: number | null
        }
        Update: {
          block_key?: string | null
          created_at?: string
          day_key?: string | null
          exercise?: string
          id?: string
          is_pr?: boolean
          month_key?: string | null
          notes?: string | null
          performed_on?: string
          reps?: number | null
          time_seconds?: number | null
          user_id?: string
          week?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_log_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          achieved_at: string
          code: string
          detail: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          code: string
          detail?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          code?: string
          detail?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string
          message: string | null
          post_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind: string
          message?: string | null
          post_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          message?: string | null
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_record_history: {
        Row: {
          changed_at: string
          exercise: string
          id: string
          new_weight: number
          previous_weight: number | null
          rep_max: number
          user_id: string
        }
        Insert: {
          changed_at?: string
          exercise: string
          id?: string
          new_weight: number
          previous_weight?: number | null
          rep_max?: number
          user_id: string
        }
        Update: {
          changed_at?: string
          exercise?: string
          id?: string
          new_weight?: number
          previous_weight?: number | null
          rep_max?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_record_history_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          created_at: string
          exercise: string
          id: string
          notes: string | null
          rep_max: number
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          notes?: string | null
          rep_max?: number
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          notes?: string | null
          rep_max?: number
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planning: {
        Row: {
          data: Json
          id: string
          imported_at: string
          is_active: boolean
          source_filename: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          data: Json
          id?: string
          imported_at?: string
          is_active?: boolean
          source_filename?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          data?: Json
          id?: string
          imported_at?: string
          is_active?: boolean
          source_filename?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "planning_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          position: number
          post_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          post_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          post_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          comments_count: number
          created_at: string
          data: Json
          hashtags: string[]
          id: string
          is_hidden: boolean
          kind: string
          likes_count: number
          saves_count: number
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          data?: Json
          hashtags?: string[]
          id?: string
          is_hidden?: boolean
          kind?: string
          likes_count?: number
          saves_count?: number
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          data?: Json
          hashtags?: string[]
          id?: string
          is_hidden?: boolean
          kind?: string
          likes_count?: number
          saves_count?: number
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          name: string
          pin_hash: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          pin_hash: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pin_hash?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          post_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      security_config: {
        Row: {
          id: boolean
          owner_rls_enforced: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          owner_rls_enforced?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          owner_rls_enforced?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      social_profiles: {
        Row: {
          allow_comments: boolean
          avatar_url: string | null
          bio: string | null
          box_name: string | null
          created_at: string
          crossfit_start_date: string | null
          display_name: string | null
          id: string
          is_admin: boolean
          is_private: boolean
          level: string | null
          public_exercises: Json
          show_prs: boolean
          show_stats: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          allow_comments?: boolean
          avatar_url?: string | null
          bio?: string | null
          box_name?: string | null
          created_at?: string
          crossfit_start_date?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_private?: boolean
          level?: string | null
          public_exercises?: Json
          show_prs?: boolean
          show_stats?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          allow_comments?: boolean
          avatar_url?: string | null
          bio?: string | null
          box_name?: string | null
          created_at?: string
          crossfit_start_date?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_private?: boolean
          level?: string | null
          public_exercises?: Json
          show_prs?: boolean
          show_stats?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      wellness_logs: {
        Row: {
          created_at: string
          energy: number | null
          fatigue: number | null
          id: string
          logged_on: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          soreness: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          fatigue?: number | null
          id?: string
          logged_on?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          soreness?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          fatigue?: number | null
          id?: string
          logged_on?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          soreness?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_logs_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wod_results: {
        Row: {
          block_key: string | null
          calories: number | null
          created_at: string
          day_key: string | null
          distance: number | null
          id: string
          is_pr: boolean
          month_key: string | null
          notes: string | null
          performed_on: string
          reps: number | null
          rounds: number | null
          rpe: number | null
          scale: string
          source: string
          status: string
          time_seconds: number | null
          updated_at: string
          user_id: string
          week: number | null
          weight: number | null
          wod_name: string
          wod_slug: string
          wod_type: string
        }
        Insert: {
          block_key?: string | null
          calories?: number | null
          created_at?: string
          day_key?: string | null
          distance?: number | null
          id?: string
          is_pr?: boolean
          month_key?: string | null
          notes?: string | null
          performed_on?: string
          reps?: number | null
          rounds?: number | null
          rpe?: number | null
          scale?: string
          source?: string
          status?: string
          time_seconds?: number | null
          updated_at?: string
          user_id: string
          week?: number | null
          weight?: number | null
          wod_name: string
          wod_slug: string
          wod_type?: string
        }
        Update: {
          block_key?: string | null
          calories?: number | null
          created_at?: string
          day_key?: string | null
          distance?: number | null
          id?: string
          is_pr?: boolean
          month_key?: string | null
          notes?: string | null
          performed_on?: string
          reps?: number | null
          rounds?: number | null
          rpe?: number | null
          scale?: string
          source?: string
          status?: string
          time_seconds?: number | null
          updated_at?: string
          user_id?: string
          week?: number | null
          weight?: number | null
          wod_name?: string
          wod_slug?: string
          wod_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wod_results_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_results: {
        Row: {
          block_key: string
          created_at: string
          day_key: string
          id: string
          month_key: string
          notes: string | null
          reps: number | null
          rpe: number | null
          scale: string | null
          sets: number | null
          status: string
          time_seconds: number | null
          updated_at: string
          user_id: string
          week: number
          weight: number | null
        }
        Insert: {
          block_key: string
          created_at?: string
          day_key: string
          id?: string
          month_key: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          scale?: string | null
          sets?: number | null
          status?: string
          time_seconds?: number | null
          updated_at?: string
          user_id: string
          week: number
          weight?: number | null
        }
        Update: {
          block_key?: string
          created_at?: string
          day_key?: string
          id?: string
          month_key?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          scale?: string | null
          sets?: number | null
          status?: string
          time_seconds?: number | null
          updated_at?: string
          user_id?: string
          week?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_results_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
