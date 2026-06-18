import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendPushToUser } from "../_shared/push.ts";

/**
 * call-reminder: Designed to be called by pg_cron or external cron every ~30 seconds.
 * Sends push notifications 1 minute before each upcoming booking.
 *
 * Cron setup (pg_cron):
 *   SELECT cron.schedule('call-reminder', '* * * * *',
 *     $$ SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/call-reminder',
 *       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     ) $$
 *   );
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify this is called with service role key (cron) or valid auth
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader?.includes(serviceRoleKey)) {
      // Also accept a valid JWT from the anon key for testing
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const testClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || "" } },
      });
      const { error } = await testClient.auth.getUser();
      if (error) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - service role key or valid JWT required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find bookings starting in ~1 minute (30-second window: 45s to 75s from now)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 45 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 75 * 1000).toISOString();

    const { data: upcomingBookings, error: queryError } = await supabase
      .from("bookings")
      .select(`
        id,
        host_id,
        guest_id,
        friend_link_id,
        start_time,
        video_app,
        video_url,
        status
      `)
      .eq("status", "confirmed")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd);

    if (queryError) {
      console.error("Query error:", queryError.message);
      return new Response(
        JSON.stringify({ error: "Failed to query bookings", details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming bookings in window", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      bookingId: string;
      hostNotified: boolean;
      guestNotified: boolean;
      error?: string;
    }> = [];

    for (const booking of upcomingBookings) {
      const result = {
        bookingId: booking.id,
        hostNotified: false,
        guestNotified: false,
        error: undefined as string | undefined,
      };

      try {
        // Get names for personalized messages
        const { data: hostProfile } = await supabase
          .from("profiles")
          .select("full_name, push_token, phone")
          .eq("id", booking.host_id)
          .single();

        const { data: guestProfile } = await supabase
          .from("profiles")
          .select("full_name, push_token, phone")
          .eq("id", booking.guest_id)
          .single();

        const hostName = hostProfile?.full_name || "your friend";
        const guestName = guestProfile?.full_name || "your friend";

        const notificationData = {
          type: "call_reminder",
          bookingId: booking.id,
          videoApp: booking.video_app,
          videoUrl: booking.video_url,
          startTime: booking.start_time,
          friendPhone: "", // filled per-recipient below
        };

        // Notify host
        try {
          await sendPushToUser(
            booking.host_id,
            "5MCU Call",
            `Video call with ${guestName} in 1 minute`,
            { ...notificationData, friendPhone: guestProfile?.phone || "" },
          );
          result.hostNotified = true;
        } catch (e) {
          console.error(`Failed to notify host ${booking.host_id}:`, (e as Error).message);
        }

        // Notify guest
        try {
          await sendPushToUser(
            booking.guest_id,
            "5MCU Call",
            `Video call with ${hostName} in 1 minute`,
            { ...notificationData, friendPhone: hostProfile?.phone || "" },
          );
          result.guestNotified = true;
        } catch (e) {
          console.error(`Failed to notify guest ${booking.guest_id}:`, (e as Error).message);
        }

        // Mark booking as reminder_sent to avoid duplicate notifications
        await supabase
          .from("bookings")
          .update({ reminder_sent: true })
          .eq("id", booking.id)
          .eq("reminder_sent", false); // Only update if not already sent
      } catch (e) {
        result.error = (e as Error).message;
        console.error(`Error processing booking ${booking.id}:`, e);
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} booking reminders`,
        count: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("call-reminder error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
