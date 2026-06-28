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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blocks: {
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
      bookmarks: {
        Row: {
          bookmarked_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bookmarked_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bookmarked_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          caller_id: string
          created_at: string
          ended_at: string | null
          id: string
          match_id: string | null
          mode: string
          receiver_id: string
          status: string
          updated_at: string
        }
        Insert: {
          caller_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          match_id?: string | null
          mode?: string
          receiver_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          match_id?: string | null
          mode?: string
          receiver_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          active: boolean
          challenge_type: string
          created_at: string
          description: string
          emoji: string
          id: string
          reward_badge: string | null
          reward_coins: number
          target_count: number
          title: string
        }
        Insert: {
          active?: boolean
          challenge_type?: string
          created_at?: string
          description: string
          emoji?: string
          id?: string
          reward_badge?: string | null
          reward_coins?: number
          target_count?: number
          title: string
        }
        Update: {
          active?: boolean
          challenge_type?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          reward_badge?: string | null
          reward_coins?: number
          target_count?: number
          title?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      compliments: {
        Row: {
          created_at: string
          id: string
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      crush_events: {
        Row: {
          created_at: string
          crush_limit_override: number | null
          description: string
          emoji: string
          end_time: string
          event_type: string
          id: string
          reveal_mutual: boolean
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          crush_limit_override?: number | null
          description?: string
          emoji?: string
          end_time: string
          event_type?: string
          id?: string
          reveal_mutual?: boolean
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          crush_limit_override?: number | null
          description?: string
          emoji?: string
          end_time?: string
          event_type?: string
          id?: string
          reveal_mutual?: boolean
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      daily_rewards: {
        Row: {
          created_at: string
          id: string
          last_claim_date: string
          streak_count: number
          total_claims: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_claim_date?: string
          streak_count?: number
          total_claims?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_claim_date?: string
          streak_count?: number
          total_claims?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          favorited_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorited_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorited_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_catalog: {
        Row: {
          coin_cost: number
          created_at: string
          emoji: string
          id: string
          name: string
        }
        Insert: {
          coin_cost?: number
          created_at?: string
          emoji: string
          id?: string
          name: string
        }
        Update: {
          coin_cost?: number
          created_at?: string
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          coin_cost: number
          created_at: string
          gift_emoji: string
          gift_name: string
          id: string
          match_id: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          coin_cost?: number
          created_at?: string
          gift_emoji: string
          gift_name: string
          id?: string
          match_id?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          coin_cost?: number
          created_at?: string
          gift_emoji?: string
          gift_name?: string
          id?: string
          match_id?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          liked_id: string
          liker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liked_id: string
          liker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liked_id?: string
          liker_id?: string
        }
        Relationships: []
      }
      live_join_requests: {
        Row: {
          created_at: string
          id: string
          room_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_join_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          room_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          room_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rooms: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          host_id: string
          id: string
          is_active: boolean
          title: string
          viewer_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          is_active?: boolean
          title: string
          viewer_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean
          title?: string
          viewer_count?: number
        }
        Relationships: []
      }
      match_streaks: {
        Row: {
          id: string
          last_message_date: string
          match_id: string
          streak_count: number
          updated_at: string
        }
        Insert: {
          id?: string
          last_message_date?: string
          match_id: string
          streak_count?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_message_date?: string
          match_id?: string
          streak_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_streaks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          date_of_birth: string | null
          first_name: string | null
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          date_of_birth?: string | null
          first_name?: string | null
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          date_of_birth?: string | null
          first_name?: string | null
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_visitors: {
        Row: {
          created_at: string
          id: string
          visited_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          visited_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          visited_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          available_tonight: boolean | null
          avatar_url: string | null
          bio: string | null
          boost_expires_at: string | null
          children: string | null
          continent: string | null
          country: string | null
          created_at: string
          dating_intents: string[] | null
          diet: string | null
          display_name: string
          drinking: string | null
          education: string | null
          email_verified: boolean
          ethnicity: string | null
          fitness: string | null
          gender: string | null
          height_cm: number | null
          id: string
          interests: string[] | null
          is_boosted: boolean | null
          is_online: boolean | null
          is_spotlight: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          last_online: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          looking_for: string | null
          occupation: string | null
          onboarding_completed: boolean
          personality_answers: Json | null
          personality_traits: string[] | null
          pets: string[] | null
          photo_verification_pending: boolean
          photos: string[] | null
          profile_completed: boolean
          relationship_status: string | null
          religion: string | null
          sexuality: string | null
          sleep_schedule: string | null
          smoking: string | null
          spotlight_expires_at: string | null
          star_sign: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          voice_intro_url: string | null
        }
        Insert: {
          age?: number | null
          available_tonight?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          boost_expires_at?: string | null
          children?: string | null
          continent?: string | null
          country?: string | null
          created_at?: string
          dating_intents?: string[] | null
          diet?: string | null
          display_name?: string
          drinking?: string | null
          education?: string | null
          email_verified?: boolean
          ethnicity?: string | null
          fitness?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          is_boosted?: boolean | null
          is_online?: boolean | null
          is_spotlight?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          last_online?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          looking_for?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          personality_answers?: Json | null
          personality_traits?: string[] | null
          pets?: string[] | null
          photo_verification_pending?: boolean
          photos?: string[] | null
          profile_completed?: boolean
          relationship_status?: string | null
          religion?: string | null
          sexuality?: string | null
          sleep_schedule?: string | null
          smoking?: string | null
          spotlight_expires_at?: string | null
          star_sign?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          voice_intro_url?: string | null
        }
        Update: {
          age?: number | null
          available_tonight?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          boost_expires_at?: string | null
          children?: string | null
          continent?: string | null
          country?: string | null
          created_at?: string
          dating_intents?: string[] | null
          diet?: string | null
          display_name?: string
          drinking?: string | null
          education?: string | null
          email_verified?: boolean
          ethnicity?: string | null
          fitness?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          is_boosted?: boolean | null
          is_online?: boolean | null
          is_spotlight?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          last_online?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          looking_for?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          personality_answers?: Json | null
          personality_traits?: string[] | null
          pets?: string[] | null
          photo_verification_pending?: boolean
          photos?: string[] | null
          profile_completed?: boolean
          relationship_status?: string | null
          religion?: string | null
          sexuality?: string | null
          sleep_schedule?: string | null
          smoking?: string | null
          spotlight_expires_at?: string | null
          star_sign?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          voice_intro_url?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          reward_given: boolean
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          reward_given?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          reward_given?: boolean
          status?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
        }
        Relationships: []
      }
      secret_crushes: {
        Row: {
          created_at: string
          crushed_id: string
          crusher_id: string
          id: string
          is_mutual: boolean
        }
        Insert: {
          created_at?: string
          crushed_id: string
          crusher_id: string
          id?: string
          is_mutual?: boolean
        }
        Update: {
          created_at?: string
          crushed_id?: string
          crusher_id?: string
          id?: string
          is_mutual?: boolean
        }
        Relationships: []
      }
      speed_dating_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          user1_id: string
          user1_liked: boolean | null
          user2_id: string
          user2_liked: boolean | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user1_id: string
          user1_liked?: boolean | null
          user2_id: string
          user2_liked?: boolean | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user1_id?: string
          user1_liked?: boolean | null
          user2_id?: string
          user2_liked?: boolean | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_likes: {
        Row: {
          created_at: string
          id: string
          liked_id: string
          liker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liked_id: string
          liker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liked_id?: string
          liker_id?: string
        }
        Relationships: []
      }
      swipe_history: {
        Row: {
          created_at: string
          direction: string
          id: string
          swiped_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          swiped_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          swiped_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_emoji: string
          badge_name: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_emoji: string
          badge_name: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_emoji?: string
          badge_name?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id: string
          week_start?: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coins: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_filter_preferences: {
        Row: {
          created_at: string
          filters: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_verifications: {
        Row: {
          selfie_url: string | null
          updated_at: string
          user_id: string
          verified_at: string
        }
        Insert: {
          selfie_url?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          selfie_url?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      waves: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_boost: { Args: never; Returns: string }
      activate_spotlight: { Args: never; Returns: string }
      adjust_coin_balance: {
        Args: { _delta: number; _metadata?: Json; _reason: string }
        Returns: number
      }
      claim_daily_reward: {
        Args: never
        Returns: {
          coin_reward: number
          day_index: number
          streak_count: number
        }[]
      }
      confirm_mutual_crush: {
        Args: { _other_user_id: string }
        Returns: boolean
      }
      create_match_if_mutual: {
        Args: { _other_user_id: string }
        Returns: string
      }
      get_my_coordinates: {
        Args: never
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      send_gift: {
        Args: {
          _gift_emoji: string
          _gift_name: string
          _match_id?: string
          _receiver_id: string
        }
        Returns: string
      }
      send_notification: {
        Args: {
          _message: string
          _target_user_id: string
          _title: string
          _type: string
        }
        Returns: string
      }
      submit_verification: { Args: { _selfie_url: string }; Returns: undefined }
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
