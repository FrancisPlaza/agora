export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ballots: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          submitted_at: string | null
          updated_at: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          topic_id: number
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
          voter_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          topic_id: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          voter_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          topic_id?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["profile_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_admin?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          ballot_id: string
          created_at: string
          rank: number
          topic_id: number
        }
        Insert: {
          ballot_id: string
          created_at?: string
          rank: number
          topic_id: number
        }
        Update: {
          ballot_id?: string
          created_at?: string
          rank?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rankings_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      tally_results: {
        Row: {
          created_at: string
          exhausted: number
          rounds: Json
          run_num: number
          total_ballots: number
          winner_topic_id: number | null
        }
        Insert: {
          created_at?: string
          exhausted?: number
          rounds: Json
          run_num: number
          total_ballots: number
          winner_topic_id?: number | null
        }
        Update: {
          created_at?: string
          exhausted?: number
          rounds?: Json
          run_num?: number
          total_ballots?: number
          winner_topic_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tally_results_winner_topic_id_fkey"
            columns: ["winner_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          art_explanation: string | null
          art_image_path: string | null
          art_title: string | null
          art_uploaded_at: string | null
          created_at: string
          id: number
          order_num: number
          philosopher: string
          presented_at: string | null
          presenter_voter_id: string | null
          scheduled_for: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          art_explanation?: string | null
          art_image_path?: string | null
          art_title?: string | null
          art_uploaded_at?: string | null
          created_at?: string
          id: number
          order_num: number
          philosopher: string
          presented_at?: string | null
          presenter_voter_id?: string | null
          scheduled_for?: string | null
          theme: string
          updated_at?: string
        }
        Update: {
          art_explanation?: string | null
          art_image_path?: string | null
          art_title?: string | null
          art_uploaded_at?: string | null
          created_at?: string
          id?: number
          order_num?: number
          philosopher?: string
          presented_at?: string | null
          presenter_voter_id?: string | null
          scheduled_for?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_presenter_voter_id_fkey"
            columns: ["presenter_voter_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voting_state: {
        Row: {
          deadline_at: string | null
          id: number
          polls_locked: boolean
          polls_locked_at: string | null
          polls_locked_by: string | null
          polls_open_at: string | null
          tally_run_at: string | null
          updated_at: string
        }
        Insert: {
          deadline_at?: string | null
          id?: number
          polls_locked?: boolean
          polls_locked_at?: string | null
          polls_locked_by?: string | null
          polls_open_at?: string | null
          tally_run_at?: string | null
          updated_at?: string
        }
        Update: {
          deadline_at?: string | null
          id?: number
          polls_locked?: boolean
          polls_locked_at?: string | null
          polls_locked_by?: string | null
          polls_open_at?: string | null
          tally_run_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voting_state_polls_locked_by_fkey"
            columns: ["polls_locked_by"]
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
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      save_draft_rankings: { Args: { p_rankings: Json }; Returns: undefined }
      submit_ballot: { Args: { p_rankings: Json }; Returns: undefined }
      write_tally_results: {
        Args: { p_results: Json; p_total_ballots: number }
        Returns: undefined
      }
    }
    Enums: {
      note_visibility: "private" | "class"
      profile_status:
        | "pending_email"
        | "pending_approval"
        | "approved"
        | "rejected"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      note_visibility: ["private", "class"],
      profile_status: [
        "pending_email",
        "pending_approval",
        "approved",
        "rejected",
      ],
    },
  },
} as const

