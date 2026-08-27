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
    PostgrestVersion: "14.17"
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          week?: number | null
          weight?: number | null
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      planning: {
        Row: {
          data: Json
          id: string
          imported_at: string
          is_active: boolean
          source_filename: string | null
          version: number
        }
        Insert: {
          data: Json
          id?: string
          imported_at?: string
          is_active?: boolean
          source_filename?: string | null
          version?: number
        }
        Update: {
          data?: Json
          id?: string
          imported_at?: string
          is_active?: boolean
          source_filename?: string | null
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          pin_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pin_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pin_hash?: string
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
        Relationships: []
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          week?: number
          weight?: number | null
        }
        Relationships: []
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
