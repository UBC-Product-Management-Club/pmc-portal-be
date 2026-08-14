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
      Admin_Allowlist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          role: Database["public"]["Enums"]["ADMIN_ROLE"]
          team: Database["public"]["Enums"]["RECRUITING_TEAM"] | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          role?: Database["public"]["Enums"]["ADMIN_ROLE"]
          team?: Database["public"]["Enums"]["RECRUITING_TEAM"] | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          role?: Database["public"]["Enums"]["ADMIN_ROLE"]
          team?: Database["public"]["Enums"]["RECRUITING_TEAM"] | null
        }
        Relationships: [
          {
            foreignKeyName: "Admin_Allowlist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      Recruiting_Application: {
        Row: {
          answers: Json
          application_id: string
          choice_rank:
            | Database["public"]["Enums"]["APPLICATION_CHOICE_RANK"]
            | null
          created_at: string
          cycle_id: string
          general_notes: string | null
          is_submitted: boolean
          referral_notes: string | null
          referred_by: string | null
          resume_url: string | null
          role_id: string
          status: Database["public"]["Enums"]["APPLICATION_STATUS"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          application_id?: string
          choice_rank?:
            | Database["public"]["Enums"]["APPLICATION_CHOICE_RANK"]
            | null
          created_at?: string
          cycle_id: string
          general_notes?: string | null
          is_submitted?: boolean
          referral_notes?: string | null
          referred_by?: string | null
          resume_url?: string | null
          role_id: string
          status?: Database["public"]["Enums"]["APPLICATION_STATUS"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          application_id?: string
          choice_rank?:
            | Database["public"]["Enums"]["APPLICATION_CHOICE_RANK"]
            | null
          created_at?: string
          cycle_id?: string
          general_notes?: string | null
          is_submitted?: boolean
          referral_notes?: string | null
          referred_by?: string | null
          resume_url?: string | null
          role_id?: string
          status?: Database["public"]["Enums"]["APPLICATION_STATUS"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Recruiting_Application_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "Recruiting_Cycle"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "Recruiting_Application_cycle_id_role_id_fkey"
            columns: ["cycle_id", "role_id"]
            isOneToOne: false
            referencedRelation: "Recruiting_Role"
            referencedColumns: ["cycle_id", "role_id"]
          },
          {
            foreignKeyName: "Recruiting_Application_user_id_fkey"
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
          created_at: string
          event_form_answers: Json | null
          event_id: string
          is_payment_verified: boolean
          last_updated: string
          payment_id: string | null
          status: Database["public"]["Enums"]["ATTENDEE_STATUS"] | null
          user_id: string
        }
        Insert: {
          attendee_id?: string
          created_at?: string
          event_form_answers?: Json | null
          event_id: string
          is_payment_verified?: boolean
          last_updated?: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["ATTENDEE_STATUS"] | null
          user_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string
          event_form_answers?: Json | null
          event_id?: string
          is_payment_verified?: boolean
          last_updated?: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["ATTENDEE_STATUS"] | null
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
      birthdays: {
        Row: {
          birthday: string
          id: number
          name: string
          slack_user_id: string
        }
        Insert: {
          birthday: string
          id?: never
          name: string
          slack_user_id: string
        }
        Update: {
          birthday?: string
          id?: never
          name?: string
          slack_user_id?: string
        }
        Relationships: []
      }
      Checkout_Session: {
        Row: {
          attendee_id: string
          checkout_id: string
          expires_at: string
        }
        Insert: {
          attendee_id?: string
          checkout_id: string
          expires_at?: string
        }
        Update: {
          attendee_id?: string
          checkout_id?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Checkout_Session_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: true
            referencedRelation: "Attendee"
            referencedColumns: ["attendee_id"]
          },
        ]
      }
      Deliverable: {
        Row: {
          created_at: string | null
          deliverable_id: string
          event_id: string
          submission: Json | null
          submitted_at: string | null
          submitted_by: string | null
          team_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          deliverable_id?: string
          event_id: string
          submission?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          team_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          deliverable_id?: string
          event_id?: string
          submission?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          team_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Deliverable_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deliverables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "deliverables_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["team_id"]
          },
        ]
      }
      Deliverable_Flags: {
        Row: {
          deadline: string
          event_id: string
          id: string
          is_enabled: boolean
          starttime: string | null
        }
        Insert: {
          deadline: string
          event_id: string
          id?: string
          is_enabled: boolean
          starttime?: string | null
        }
        Update: {
          deadline?: string
          event_id?: string
          id?: string
          is_enabled?: boolean
          starttime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Deliverable_Flags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
        ]
      }
      Drafts: {
        Row: {
          draft_data: Json | null
          event_id: string
          user_id: string
        }
        Insert: {
          draft_data?: Json | null
          event_id?: string
          user_id?: string
        }
        Update: {
          draft_data?: Json | null
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "Drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
      Event: {
        Row: {
          blurb: string
          date: string | null
          description: string | null
          end_time: string | null
          event_form_questions: Json
          event_id: string
          external_page: string | null
          is_disabled: boolean | null
          location: string | null
          mailing_list: string | null
          max_attendees: number | null
          media: string[] | null
          member_price: number | null
          member_price_id: string | null
          name: string
          needs_review: boolean
          non_member_price: number | null
          non_member_price_id: string | null
          registration_closes: string | null
          registration_opens: string | null
          start_time: string | null
          waitlist_form: string | null
        }
        Insert: {
          blurb?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_form_questions: Json
          event_id?: string
          external_page?: string | null
          is_disabled?: boolean | null
          location?: string | null
          mailing_list?: string | null
          max_attendees?: number | null
          media?: string[] | null
          member_price?: number | null
          member_price_id?: string | null
          name: string
          needs_review?: boolean
          non_member_price?: number | null
          non_member_price_id?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          start_time?: string | null
          waitlist_form?: string | null
        }
        Update: {
          blurb?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_form_questions?: Json
          event_id?: string
          external_page?: string | null
          is_disabled?: boolean | null
          location?: string | null
          mailing_list?: string | null
          max_attendees?: number | null
          media?: string[] | null
          member_price?: number | null
          member_price_id?: string | null
          name?: string
          needs_review?: boolean
          non_member_price?: number | null
          non_member_price_id?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          start_time?: string | null
          waitlist_form?: string | null
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
            foreignKeyName: "Payment_user_id_fkey"
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
      Recruiting_Cycle: {
        Row: {
          closes_at: string | null
          created_at: string
          cycle_id: string
          general_questions: Json
          is_active: boolean
          name: string
          opens_at: string | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          cycle_id?: string
          general_questions?: Json
          is_active?: boolean
          name: string
          opens_at?: string | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          cycle_id?: string
          general_questions?: Json
          is_active?: boolean
          name?: string
          opens_at?: string | null
        }
        Relationships: []
      }
      Recruiting_Role: {
        Row: {
          created_at: string
          cycle_id: string
          is_active: boolean
          name: string
          questions: Json
          role_id: string
          team: Database["public"]["Enums"]["RECRUITING_TEAM"]
        }
        Insert: {
          created_at?: string
          cycle_id: string
          is_active?: boolean
          name: string
          questions?: Json
          role_id?: string
          team: Database["public"]["Enums"]["RECRUITING_TEAM"]
        }
        Update: {
          created_at?: string
          cycle_id?: string
          is_active?: boolean
          name?: string
          questions?: Json
          role_id?: string
          team?: Database["public"]["Enums"]["RECRUITING_TEAM"]
        }
        Relationships: [
          {
            foreignKeyName: "Recruiting_Role_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "Recruiting_Cycle"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          role_name: string
          slack_user_id: string
        }
        Insert: {
          id?: never
          role_name: string
          slack_user_id: string
        }
        Update: {
          id?: never
          role_name?: string
          slack_user_id?: string
        }
        Relationships: []
      }
      Team: {
        Row: {
          event_id: string
          team_code: string | null
          team_id: string
          team_name: string
        }
        Insert: {
          event_id?: string
          team_code?: string | null
          team_id?: string
          team_name: string
        }
        Update: {
          event_id?: string
          team_code?: string | null
          team_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "Teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["event_id"]
          },
        ]
      }
      Team_Member: {
        Row: {
          attendee_id: string
          team_id: string
        }
        Insert: {
          attendee_id?: string
          team_id?: string
        }
        Update: {
          attendee_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Team_Member_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "Attendee"
            referencedColumns: ["attendee_id"]
          },
          {
            foreignKeyName: "Team_Member_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["team_id"]
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
      Current_Cycle_Application: {
        Row: {
          answers: Json | null
          application_id: string | null
          choice_rank:
            | Database["public"]["Enums"]["APPLICATION_CHOICE_RANK"]
            | null
          created_at: string | null
          cycle_id: string | null
          general_notes: string | null
          is_submitted: boolean | null
          referral_notes: string | null
          referred_by: string | null
          resume_url: string | null
          role_id: string | null
          status: Database["public"]["Enums"]["APPLICATION_STATUS"] | null
          submitted_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Recruiting_Application_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "Recruiting_Cycle"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "Recruiting_Application_cycle_id_role_id_fkey"
            columns: ["cycle_id", "role_id"]
            isOneToOne: false
            referencedRelation: "Recruiting_Role"
            referencedColumns: ["cycle_id", "role_id"]
          },
          {
            foreignKeyName: "Recruiting_Application_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      create_team_with_members: {
        Args: {
          p_event_id: string
          p_member_attendee_ids: string[]
          p_team_name: string
        }
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      get_deliverable_submissions: { Args: { event_id: string }; Returns: Json }
      get_todays_birthdays: {
        Args: never
        Returns: {
          birthday: string
          id: number
          name: string
          slack_user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "birthdays"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      ADMIN_ROLE: "PRESIDENT" | "VP" | "EXEC"
      APPLICATION_CHOICE_RANK: "FIRST" | "SECOND" | "THIRD_PLUS" | "ONLY"
      APPLICATION_STATUS:
        | "DRAFT"
        | "SUBMITTED"
        | "REVIEWED"
        | "WILL_REJECT"
        | "REJECTED_EMAIL_SENT"
        | "INTERVIEW_INVITED"
        | "INTERVIEW_SCHEDULED"
        | "INTERVIEWED"
        | "OFFER_SENT"
        | "OFFER_ACCEPTED"
        | "OFFER_DECLINED"
      ATTENDEE_STATUS:
        | "FAILED"
        | "PROCESSING"
        | "APPLIED"
        | "REGISTERED"
        | "ACCEPTED"
      PAYMENT_STATUS: "PROCESSING" | "VERIFIED"
      RECRUITING_TEAM:
        | "TECH"
        | "MARKETING_MEDIA"
        | "MARKETING_DESIGN"
        | "EVENTS"
        | "PARTNERSHIPS"
        | "COMMUNITY"
        | "FINANCE"
        | "LEADERSHIP"
        | "EXDEV"
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
    Enums: {
      ADMIN_ROLE: ["PRESIDENT", "VP", "EXEC"],
      APPLICATION_CHOICE_RANK: ["FIRST", "SECOND", "THIRD_PLUS", "ONLY"],
      APPLICATION_STATUS: [
        "DRAFT",
        "SUBMITTED",
        "REVIEWED",
        "WILL_REJECT",
        "REJECTED_EMAIL_SENT",
        "INTERVIEW_INVITED",
        "INTERVIEW_SCHEDULED",
        "INTERVIEWED",
        "OFFER_SENT",
        "OFFER_ACCEPTED",
        "OFFER_DECLINED",
      ],
      ATTENDEE_STATUS: [
        "FAILED",
        "PROCESSING",
        "APPLIED",
        "REGISTERED",
        "ACCEPTED",
      ],
      PAYMENT_STATUS: ["PROCESSING", "VERIFIED"],
      RECRUITING_TEAM: [
        "TECH",
        "MARKETING_MEDIA",
        "MARKETING_DESIGN",
        "EVENTS",
        "PARTNERSHIPS",
        "COMMUNITY",
        "FINANCE",
        "LEADERSHIP",
        "EXDEV",
      ],
    },
  },
} as const
