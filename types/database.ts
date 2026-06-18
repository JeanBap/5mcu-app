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
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          preferred_video_app: Database["public"]["Enums"]["video_app_type"];
          timezone: string;
          push_token: string | null;
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferred_video_app?: Database["public"]["Enums"]["video_app_type"];
          timezone?: string;
          push_token?: string | null;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          preferred_video_app?: Database["public"]["Enums"]["video_app_type"];
          timezone?: string;
          push_token?: string | null;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      availability_slots: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          is_booked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time: string;
          is_booked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string;
          is_booked?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_slots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friends: {
        Row: {
          id: string;
          user_id: string;
          friend_user_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          frequency: Database["public"]["Enums"]["frequency_type"];
          status: Database["public"]["Enums"]["friend_status"];
          invite_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_user_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          frequency?: Database["public"]["Enums"]["frequency_type"];
          status?: Database["public"]["Enums"]["friend_status"];
          invite_code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_user_id?: string | null;
          name?: string;
          phone?: string | null;
          email?: string | null;
          frequency?: Database["public"]["Enums"]["frequency_type"];
          status?: Database["public"]["Enums"]["friend_status"];
          invite_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friends_friend_user_id_fkey";
            columns: ["friend_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          id: string;
          from_user_id: string;
          to_email: string | null;
          to_phone: string | null;
          friend_link_id: string;
          invite_code: string;
          status: Database["public"]["Enums"]["invite_status"];
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_email?: string | null;
          to_phone?: string | null;
          friend_link_id: string;
          invite_code: string;
          status?: Database["public"]["Enums"]["invite_status"];
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          to_email?: string | null;
          to_phone?: string | null;
          friend_link_id?: string;
          invite_code?: string;
          status?: Database["public"]["Enums"]["invite_status"];
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_friend_link_id_fkey";
            columns: ["friend_link_id"];
            isOneToOne: false;
            referencedRelation: "friends";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          slot_id: string;
          booker_id: string;
          friend_link_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          video_app: Database["public"]["Enums"]["video_app_type"];
          video_url: string | null;
          scheduled_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slot_id: string;
          booker_id: string;
          friend_link_id: string;
          status?: Database["public"]["Enums"]["booking_status"];
          video_app: Database["public"]["Enums"]["video_app_type"];
          video_url?: string | null;
          scheduled_at: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slot_id?: string;
          booker_id?: string;
          friend_link_id?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          video_app?: Database["public"]["Enums"]["video_app_type"];
          video_url?: string | null;
          scheduled_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "availability_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_booker_id_fkey";
            columns: ["booker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_friend_link_id_fkey";
            columns: ["friend_link_id"];
            isOneToOne: false;
            referencedRelation: "friends";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          revenue_cat_id: string | null;
          plan: Database["public"]["Enums"]["plan_type"];
          status: Database["public"]["Enums"]["subscription_status"];
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          revenue_cat_id?: string | null;
          plan?: Database["public"]["Enums"]["plan_type"];
          status?: Database["public"]["Enums"]["subscription_status"];
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          revenue_cat_id?: string | null;
          plan?: Database["public"]["Enums"]["plan_type"];
          status?: Database["public"]["Enums"]["subscription_status"];
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      video_app_type: "whatsapp" | "facetime" | "jitsi" | "zoom";
      frequency_type: 1 | 2 | 4;
      friend_status: "pending" | "active" | "removed";
      invite_status: "pending" | "accepted" | "expired";
      booking_status: "scheduled" | "completed" | "cancelled" | "missed";
      plan_type: "free" | "premium";
      subscription_status: "active" | "cancelled" | "expired";
    };
  };
}

/** Convenience type aliases for table rows */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type AvailabilitySlot =
  Database["public"]["Tables"]["availability_slots"]["Row"];
export type AvailabilitySlotInsert =
  Database["public"]["Tables"]["availability_slots"]["Insert"];
export type AvailabilitySlotUpdate =
  Database["public"]["Tables"]["availability_slots"]["Update"];

export type Friend = Database["public"]["Tables"]["friends"]["Row"];
export type FriendInsert = Database["public"]["Tables"]["friends"]["Insert"];
export type FriendUpdate = Database["public"]["Tables"]["friends"]["Update"];

export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type InviteInsert = Database["public"]["Tables"]["invites"]["Insert"];
export type InviteUpdate = Database["public"]["Tables"]["invites"]["Update"];

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingInsert = Database["public"]["Tables"]["bookings"]["Insert"];
export type BookingUpdate = Database["public"]["Tables"]["bookings"]["Update"];

export type Subscription =
  Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionInsert =
  Database["public"]["Tables"]["subscriptions"]["Insert"];
export type SubscriptionUpdate =
  Database["public"]["Tables"]["subscriptions"]["Update"];

/** Enum convenience types */
export type VideoAppType = Database["public"]["Enums"]["video_app_type"];
export type FrequencyType = Database["public"]["Enums"]["frequency_type"];
export type FriendStatus = Database["public"]["Enums"]["friend_status"];
export type InviteStatus = Database["public"]["Enums"]["invite_status"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PlanType = Database["public"]["Enums"]["plan_type"];
export type SubscriptionStatus =
  Database["public"]["Enums"]["subscription_status"];
