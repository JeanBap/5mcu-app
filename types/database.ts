/**
 * Supabase Database Types for 5MCU
 *
 * Generated type pattern matching Supabase CLI output.
 * Regenerate with: npx supabase gen types typescript --project-id <project-id>
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      fmcu_profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          preferred_video_app: Database["public"]["Enums"]["fmcu_video_app"];
          push_token: string | null;
          timezone: string;
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_video_app?: Database["public"]["Enums"]["fmcu_video_app"];
          push_token?: string | null;
          timezone?: string;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_video_app?: Database["public"]["Enums"]["fmcu_video_app"];
          push_token?: string | null;
          timezone?: string;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fmcu_availability_slots: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          is_booked: boolean;
          booked_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          is_booked?: boolean;
          booked_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          is_booked?: boolean;
          booked_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fmcu_availability_slots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_availability_slots_booked_by_fkey";
            columns: ["booked_by"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fmcu_friends: {
        Row: {
          id: string;
          user_id: string;
          friend_user_id: string | null;
          friend_name: string;
          friend_phone: string | null;
          friend_email: string | null;
          frequency_per_month: number;
          status: Database["public"]["Enums"]["fmcu_friend_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_user_id?: string | null;
          friend_name: string;
          friend_phone?: string | null;
          friend_email?: string | null;
          frequency_per_month?: number;
          status?: Database["public"]["Enums"]["fmcu_friend_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_user_id?: string | null;
          friend_name?: string;
          friend_phone?: string | null;
          friend_email?: string | null;
          frequency_per_month?: number;
          status?: Database["public"]["Enums"]["fmcu_friend_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fmcu_friends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_friends_friend_user_id_fkey";
            columns: ["friend_user_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fmcu_invites: {
        Row: {
          id: string;
          from_user_id: string;
          to_friend_id: string;
          invite_code: string;
          status: Database["public"]["Enums"]["fmcu_invite_status"];
          frequency_per_month: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_friend_id: string;
          invite_code?: string;
          status?: Database["public"]["Enums"]["fmcu_invite_status"];
          frequency_per_month?: number;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          to_friend_id?: string;
          invite_code?: string;
          status?: Database["public"]["Enums"]["fmcu_invite_status"];
          frequency_per_month?: number;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fmcu_invites_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_invites_to_friend_id_fkey";
            columns: ["to_friend_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_friends";
            referencedColumns: ["id"];
          },
        ];
      };
      fmcu_bookings: {
        Row: {
          id: string;
          slot_id: string;
          host_id: string;
          guest_id: string;
          friend_link_id: string;
          status: Database["public"]["Enums"]["fmcu_booking_status"];
          video_app: Database["public"]["Enums"]["fmcu_video_app"] | null;
          video_url: string | null;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slot_id: string;
          host_id: string;
          guest_id: string;
          friend_link_id: string;
          status?: Database["public"]["Enums"]["fmcu_booking_status"];
          video_app?: Database["public"]["Enums"]["fmcu_video_app"] | null;
          video_url?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slot_id?: string;
          host_id?: string;
          guest_id?: string;
          friend_link_id?: string;
          status?: Database["public"]["Enums"]["fmcu_booking_status"];
          video_app?: Database["public"]["Enums"]["fmcu_video_app"] | null;
          video_url?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fmcu_bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_availability_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_bookings_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_bookings_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fmcu_bookings_friend_link_id_fkey";
            columns: ["friend_link_id"];
            isOneToOne: false;
            referencedRelation: "fmcu_friends";
            referencedColumns: ["id"];
          },
        ];
      };
      fmcu_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: Database["public"]["Enums"]["fmcu_sub_tier"];
          provider: Database["public"]["Enums"]["fmcu_sub_provider"] | null;
          provider_subscription_id: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: Database["public"]["Enums"]["fmcu_sub_tier"];
          provider?: Database["public"]["Enums"]["fmcu_sub_provider"] | null;
          provider_subscription_id?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: Database["public"]["Enums"]["fmcu_sub_tier"];
          provider?: Database["public"]["Enums"]["fmcu_sub_provider"] | null;
          provider_subscription_id?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fmcu_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "fmcu_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {};
    Functions: {
      fmcu_generate_invite_code: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      fmcu_video_app: "whatsapp" | "facetime" | "jitsi" | "zoom";
      fmcu_friend_status: "pending" | "active" | "paused";
      fmcu_invite_status: "pending" | "accepted" | "declined" | "expired";
      fmcu_booking_status: "confirmed" | "completed" | "cancelled" | "no_show";
      fmcu_sub_tier: "free" | "premium";
      fmcu_sub_provider: "apple" | "google" | "stripe";
    };
  };
}

/** Convenience type aliases for table rows */
export type Profile = Database["public"]["Tables"]["fmcu_profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["fmcu_profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["fmcu_profiles"]["Update"];

export type AvailabilitySlot =
  Database["public"]["Tables"]["fmcu_availability_slots"]["Row"];
export type AvailabilitySlotInsert =
  Database["public"]["Tables"]["fmcu_availability_slots"]["Insert"];
export type AvailabilitySlotUpdate =
  Database["public"]["Tables"]["fmcu_availability_slots"]["Update"];

export type Friend = Database["public"]["Tables"]["fmcu_friends"]["Row"];
export type FriendInsert = Database["public"]["Tables"]["fmcu_friends"]["Insert"];
export type FriendUpdate = Database["public"]["Tables"]["fmcu_friends"]["Update"];

export type Invite = Database["public"]["Tables"]["fmcu_invites"]["Row"];
export type InviteInsert = Database["public"]["Tables"]["fmcu_invites"]["Insert"];
export type InviteUpdate = Database["public"]["Tables"]["fmcu_invites"]["Update"];

export type Booking = Database["public"]["Tables"]["fmcu_bookings"]["Row"];
export type BookingInsert = Database["public"]["Tables"]["fmcu_bookings"]["Insert"];
export type BookingUpdate = Database["public"]["Tables"]["fmcu_bookings"]["Update"];

export type Subscription =
  Database["public"]["Tables"]["fmcu_subscriptions"]["Row"];
export type SubscriptionInsert =
  Database["public"]["Tables"]["fmcu_subscriptions"]["Insert"];
export type SubscriptionUpdate =
  Database["public"]["Tables"]["fmcu_subscriptions"]["Update"];

/** Enum convenience types */
export type VideoAppType = Database["public"]["Enums"]["fmcu_video_app"];
export type FriendStatus = Database["public"]["Enums"]["fmcu_friend_status"];
export type InviteStatus = Database["public"]["Enums"]["fmcu_invite_status"];
export type BookingStatus = Database["public"]["Enums"]["fmcu_booking_status"];
export type SubTier = Database["public"]["Enums"]["fmcu_sub_tier"];
export type SubProvider = Database["public"]["Enums"]["fmcu_sub_provider"];
