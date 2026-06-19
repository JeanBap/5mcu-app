import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendPushToUser } from "../_shared/push.ts";

interface ProcessBookingRequest {
  slot_id: string;
  guest_id: string;
  friend_link_id: string;
}

interface BookingRecord {
  id: string;
  slot_id: string;
  host_id: string;
  guest_id: string;
  friend_link_id: string;
  start_time: string;
  end_time: string;
  video_app: string;
  video_url: string;
  status: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: ProcessBookingRequest = await req.json();
    const { slot_id, guest_id, friend_link_id } = body;

    if (!slot_id || !guest_id || !friend_link_id) {
      return new Response(
        JSON.stringify({ error: "slot_id, guest_id, and friend_link_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Validate slot exists and is not already booked
    const { data: slot, error: slotError } = await supabase
      .from("fmcu_availability_slots")
      .select("id, user_id, start_time, end_time, is_booked, video_app")
      .eq("id", slot_id)
      .single();

    if (slotError || !slot) {
      return new Response(
        JSON.stringify({ error: "Slot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (slot.is_booked) {
      return new Response(
        JSON.stringify({ error: "Slot is already booked" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Validate slot is in the future
    if (new Date(slot.start_time) <= new Date()) {
      return new Response(
        JSON.stringify({ error: "Cannot book a slot in the past" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Validate friend link exists and guest has a valid invite
    const { data: friendLink, error: friendError } = await supabase
      .from("fmcu_friends")
      .select("id, user_id, friend_name, guest_user_id")
      .eq("id", friend_link_id)
      .single();

    if (friendError || !friendLink) {
      return new Response(
        JSON.stringify({ error: "Friend link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the slot belongs to the host in the friend link
    if (slot.user_id !== friendLink.user_id) {
      return new Response(
        JSON.stringify({ error: "Slot does not belong to this friend's host" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the guest is valid for this friend link
    const validGuest =
      guest_id === friendLink.guest_user_id ||
      guest_id === user.id;

    if (!validGuest) {
      return new Response(
        JSON.stringify({ error: "Guest does not have a valid invite for this friend link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check for a valid (non-expired) invite
    const { data: invite } = await supabase
      .from("fmcu_invites")
      .select("id, status, expires_at")
      .eq("friend_link_id", friend_link_id)
      .eq("status", "accepted")
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    // Allow booking if invite is accepted OR if guest_user_id is already set on friend_link
    if (!invite && !friendLink.guest_user_id) {
      return new Response(
        JSON.stringify({ error: "No valid accepted invite found for this friend link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Create booking record
    const bookingId = crypto.randomUUID();
    const videoApp = slot.video_app || "jitsi";
    let videoUrl: string;

    switch (videoApp) {
      case "jitsi":
        videoUrl = `https://meet.jit.si/5mcu-${bookingId}`;
        break;
      case "facetime":
        videoUrl = ""; // FaceTime handled natively on device
        break;
      case "zoom":
        videoUrl = ""; // Zoom link provided by user's account
        break;
      default:
        videoUrl = `https://meet.jit.si/5mcu-${bookingId}`;
    }

    const endTime = new Date(
      new Date(slot.start_time).getTime() + 5 * 60 * 1000,
    ).toISOString();

    const { data: booking, error: bookingError } = await supabase
      .from("fmcu_bookings")
      .insert({
        id: bookingId,
        slot_id: slot.id,
        host_id: slot.user_id,
        guest_id: guest_id,
        friend_link_id: friend_link_id,
        start_time: slot.start_time,
        end_time: endTime,
        video_app: videoApp,
        video_url: videoUrl,
        status: "confirmed",
      })
      .select()
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Failed to create booking", details: bookingError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Mark slot as booked
    const { error: updateError } = await supabase
      .from("fmcu_availability_slots")
      .update({ is_booked: true, booking_id: bookingId })
      .eq("id", slot_id);

    if (updateError) {
      console.error("Failed to mark slot as booked:", updateError.message);
      // Booking still created - slot status is secondary
    }

    // 6. Get guest name for notification
    const { data: guestProfile } = await supabase
      .from("fmcu_profiles")
      .select("full_name")
      .eq("id", guest_id)
      .single();

    const guestName = guestProfile?.full_name || friendLink.friend_name || "your friend";

    // 7. Send push notification to host
    try {
      await sendPushToUser(
        slot.user_id,
        "Call Booked!",
        `Call booked with ${guestName}`,
        {
          type: "booking_confirmed",
          bookingId: booking.id,
          videoApp: booking.video_app,
          videoUrl: booking.video_url,
          startTime: booking.start_time,
        },
      );
    } catch (pushErr) {
      console.error("Failed to send push to host:", (pushErr as Error).message);
      // Non-fatal: booking is still valid
    }

    const response: BookingRecord = {
      id: booking.id,
      slot_id: booking.slot_id,
      host_id: booking.host_id,
      guest_id: booking.guest_id,
      friend_link_id: booking.friend_link_id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      video_app: booking.video_app,
      video_url: booking.video_url,
      status: booking.status,
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("process-booking error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
