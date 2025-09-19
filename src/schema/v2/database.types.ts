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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      Applicants: {
        Row: {
          created_at: string
          event_form_answers: Json | null
          event_id: string | null
          registration_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_form_answers?: Json | null
          event_id?: string | null
          registration_id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_form_answers?: Json | null
          event_id?: string | null
          registration_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Registration_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "Registration_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      Attendee: {
        Row: {
          attendee_id: string
          event_form_answers: Json | null
          event_id: string
          is_payment_verified: boolean | null
          payment_id: string | null
          registration_time: string 
          status: string | null
          user_id: string
        }
        Insert: {
          attendee_id?: string
          event_form_answers?: Json | null
          event_id: string
          is_payment_verified?: boolean | null
          payment_id?: string | null
          registration_time?: string 
          status?: string | null
          user_id: string
        }
        Update: {
          attendee_id?: string
          event_form_answers?: Json | null
          event_id?: string
          is_payment_verified?: boolean | null
          payment_id?: string | null
          registration_time?: string 
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "Attendee_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "Payment"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "attendee_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      Event: {
        Row: {
          date: string | null
          blurb: string | null
          mailing_list: string | null
          description: string | null
          end_time: string | null
          event_form_questions: Json
          event_id: string
          is_disabled: boolean | null
          location: string | null
          max_attendees: number | null
          media: string[] | null
          member_price: number | null
          member_price_id: string
          name: string | null
          needs_review: boolean
          non_member_price: number | null
          non_member_price_id: string
          start_time: string | null
          thumbnail: string | null
        }
        Insert: {
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_form_questions: Json
          event_id: string
          is_disabled?: boolean | null
          location?: string | null
          max_attendees?: number | null
          media?: string[] | null
          member_price?: number | null
          member_price_id?: string
          name?: string | null
          needs_review?: boolean
          non_member_price?: number | null
          non_member_price_id?: string
          start_time?: string | null
          thumbnail?: string | null
          mailing_list?: string | null
        }
        Update: {
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_form_questions?: Json
          event_id?: string
          is_disabled?: boolean | null
          location?: string | null
          max_attendees?: number | null
          media?: string[] | null
          member_price?: number | null
          member_price_id?: string
          name?: string | null
          needs_review?: boolean
          non_member_price?: number | null
          non_member_price_id?: string
          start_time?: string | null
          thumbnail?: string | null
          mailing_list?: string | null
        }
        Relationships: []
      }
      Payment: {
        Row: {
          amount: number
          payment_date: string | null
          payment_id: string
          status: string
          type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          payment_date?: string | null
          payment_id: string
          status: string
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          payment_date?: string | null
          payment_id?: string
          status?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      Products: {
        Row: {
          id: string
          product: string
        }
        Insert: {
          id?: string
          product: string
        }
        Update: {
          id?: string
          product?: string
        }
        Relationships: []
      }
      Session: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Session_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      User: {
        Row: {
          display_name: string | null
          email: string
          faculty: string | null
          first_name: string
          is_payment_verified: boolean | null
          last_name: string
          major: string | null
          pfp: string | null
          pronouns: string | null
          student_id: string | null
          university: string | null
          user_id: string
          why_pm: string | null
          year: string | null
        }
        Insert: {
          display_name?: string | null
          email: string
          faculty?: string | null
          first_name: string
          is_payment_verified?: boolean | null
          last_name: string
          major?: string | null
          pfp?: string | null
          pronouns?: string | null
          student_id?: string | null
          university?: string | null
          user_id: string
          why_pm?: string | null
          year?: string | null
        }
        Update: {
          display_name?: string | null
          email?: string
          faculty?: string | null
          first_name?: string
          is_payment_verified?: boolean | null
          last_name?: string
          major?: string | null
          pfp?: string | null
          pronouns?: string | null
          student_id?: string | null
          university?: string | null
          user_id?: string
          why_pm?: string | null
          year?: string | null
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
