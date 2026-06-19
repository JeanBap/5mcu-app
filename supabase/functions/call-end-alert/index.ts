import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendPushToUser } from "../_shared/push.ts";

/**
 * call-end-alert: Designed to be called by pg_cron or external cron every ~30 seconds.
 * Sends "5 minutes done" notification when a call's time is up.
 * Also checks if the user has another call coming up soon.
 *
 * Cron setup (pg_cron):
 *   SELECT cron.schedule('call-end-alert', '* * * * *',
 *     $$ SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/call-end-alert',
 *       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     ) $$
 *   );
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authorize: must be service role (cron) or valid JWT
    if (!authHeader?.includes(serviceRoleKey)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const testClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || "" } },
      });
      const { error } = await testClient.auth.getUser();
      if (error) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const CALL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    // Find bookings where start_time + 5 min is ~now (30-second window)
    // We query bookings that started ~5 minutes ago
    const endWindowStart = new Date(now.getTime() - CALL_DURATION_MS - 15 * 1000).toISOString();
    const endWindowEnd = new Date(now.getTime() - CALL_DURATION_MS + 15 * 1000).toISOString();

    // Query confirmed bookings and join slot to get start_time
    const { data: allConfirmedBookings, error: queryError } = await supabase
      .from("fmcu_bookings")
      .select(`
        id,
        host_id,
        guest_id,
        friend_link_id,
        status,
        slot:fmcu_availability_slots!slot_id (
          start_time,
          end_time
        )
      `)
      .eq("status", "confirmed")
      .not("slot", "is", null);

    // Filter to bookings whose slot started ~5 minutes ago (within window)
    const endingBookings = (allConfirmedBookings || []).filter((b: any) => {
      const slotStart = b.slot?.start_time;
      if (!slotStart) return false;
      return slotStart >= endWindowStart && slotStart <= endWindowEnd;
    });

    if (queryError) {
      console.error("Query error:", queryError.message);
      return new Response(
        JSON.stringify({ error: "Failed to query bookings", details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!endingBookings || endingBookings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No ending bookings in window", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const NEXT_CALL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const results: Array<{
      bookingId: string;
      hostNotified: boolean;
      guestNotified: boolean;
      markedCompleted: boolean;
    }> = [];

    for (const booking of endingBookings) {
      const result = {
        bookingId: booking.id,
        hostNotified: false,
        guestNotified: false,
        markedCompleted: false,
      };

      try {
        // Check for next calls for both host and guest
        const nextCallWindowEnd = new Date(now.getTime() + NEXT_CALL_WINDOW_MS).toISOString();

        // Host's next call -- join through slot to get start_time
        const { data: hostNextBookings } = await supabase
          .from("fmcu_bookings")
          .select("id, guest_id, friend_link_id, slot:fmcu_availability_slots!slot_id(start_time)")
          .eq("host_id", booking.host_id)
          .eq("status", "confirmed")
          .neq("id", booking.id);

        const hostNextFiltered = (hostNextBookings || [])
          .filter((b: any) => {
            const st = b.slot?.start_time;
            return st && st >= now.toISOString() && st <= nextCallWindowEnd;
          })
          .sort((a: any, b: any) => new Date(a.slot.start_time).getTime() - new Date(b.slot.start_time).getTime());

        // Guest's next call (they might be host or guest in other bookings)
        const { data: guestNextAsHost } = await supabase
          .from("fmcu_bookings")
          .select("id, guest_id, friend_link_id, slot:fmcu_availability_slots!slot_id(start_time)")
          .eq("host_id", booking.guest_id)
          .eq("status", "confirmed")
          .neq("id", booking.id);

        const { data: guestNextAsGuest } = await supabase
          .from("fmcu_bookings")
          .select("id, host_id, friend_link_id, slot:fmcu_availability_slots!slot_id(start_time)")
          .eq("guest_id", booking.guest_id)
          .eq("status", "confirmed")
          .neq("id", booking.id);

        const hostNextCall = hostNextFiltered[0] || null;

        // Combine guest's next calls and pick the earliest
        const guestNextCalls = [
          ...(guestNextAsHost || []),
          ...(guestNextAsGuest || []),
        ]
          .filter((b: any) => {
            const st = b.slot?.start_time;
            return st && st >= now.toISOString() && st <= nextCallWindowEnd;
          })
          .sort(
            (a: any, b: any) => new Date(a.slot.start_time).getTime() - new Date(b.slot.start_time).getTime(),
          );
        const guestNextCall = guestNextCalls[0] || null;

        // Look up names for personalized messages
        const { data: hostProfile } = await supabase
          .from("fmcu_profiles")
          .select("full_name")
          .eq("id", booking.host_id)
          .single();

        const { data: guestProfile } = await supabase
          .from("fmcu_profiles")
          .select("full_name")
          .eq("id", booking.guest_id)
          .single();

        // Build notification messages
        const hostName = hostProfile?.full_name || "your friend";
        const guestName = guestProfile?.full_name || "your friend";

        // Notify host
        try {
          let hostBody: string;
          if (hostNextCall) {
            // Look up the next friend's name
            const nextFriendId = hostNextCall.guest_id;
            const { data: nextFriend } = await supabase
              .from("fmcu_profiles")
              .select("full_name")
              .eq("id", nextFriendId)
              .single();
            const nextFriendName = nextFriend?.full_name || "someone";
            hostBody = `5 min done - you have a call with ${nextFriendName} coming up`;
          } else {
            hostBody = "5 min done! Keep chatting if you'd like";
          }

          await sendPushToUser(booking.host_id, "5MCU", hostBody, {
            type: "call_end",
            bookingId: booking.id,
            hasNextCall: !!hostNextCall,
            nextBookingId: hostNextCall?.id,
          });
          result.hostNotified = true;
        } catch (e) {
          console.error(`Failed to notify host ${booking.host_id}:`, (e as Error).message);
        }

        // Notify guest
        try {
          let guestBody: string;
          if (guestNextCall) {
            const nextPersonId =
              "host_id" in guestNextCall ? guestNextCall.host_id : guestNextCall.guest_id;
            const { data: nextPerson } = await supabase
              .from("fmcu_profiles")
              .select("full_name")
              .eq("id", nextPersonId)
              .single();
            const nextPersonName = nextPerson?.full_name || "someone";
            guestBody = `5 min done - you have a call with ${nextPersonName} coming up`;
          } else {
            guestBody = "5 min done! Keep chatting if you'd like";
          }

          await sendPushToUser(booking.guest_id, "5MCU", guestBody, {
            type: "call_end",
            bookingId: booking.id,
            hasNextCall: !!guestNextCall,
            nextBookingId: guestNextCall?.id,
          });
          result.guestNotified = true;
        } catch (e) {
          console.error(`Failed to notify guest ${booking.guest_id}:`, (e as Error).message);
        }

        // Mark booking as completed
        const { error: updateError } = await supabase
          .from("fmcu_bookings")
          .update({ status: "completed" })
          .eq("id", booking.id);

        if (!updateError) {
          result.markedCompleted = true;
        } else {
          console.error(`Failed to mark booking ${booking.id} as completed:`, updateError.message);
        }
      } catch (e) {
        console.error(`Error processing booking ${booking.id}:`, e);
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} call-end alerts`,
        count: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("call-end-alert error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
