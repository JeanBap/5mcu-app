import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendPushToUser } from "../_shared/push.ts";

/**
 * auto-suggest-rebooking: Called daily by cron.
 * For each active friend relationship, checks if monthly booking target is being met.
 * If below target, finds the next available slot and nudges the friend to book.
 *
 * Cron setup (pg_cron) - run daily at 9 AM UTC:
 *   SELECT cron.schedule('auto-suggest-rebooking', '0 9 * * *',
 *     $$ SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/auto-suggest-rebooking',
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

    // Get current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Fetch all active friend links with their frequency settings
    const { data: friendLinks, error: linksError } = await supabase
      .from("fmcu_friends")
      .select(`
        id,
        user_id,
        guest_user_id,
        friend_name,
        frequency_per_month,
        status
      `)
      .eq("status", "active")
      .not("guest_user_id", "is", null) // Only friends who have signed up
      .gt("frequency_per_month", 0);

    if (linksError) {
      console.error("Failed to fetch friend links:", linksError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch friend links", details: linksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!friendLinks || friendLinks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active friend links to process", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      friendLinkId: string;
      friendName: string;
      targetPerMonth: number;
      bookingsThisMonth: number;
      belowTarget: boolean;
      notificationSent: boolean;
      suggestedSlot?: string;
    }> = [];

    for (const link of friendLinks) {
      const result = {
        friendLinkId: link.id,
        friendName: link.friend_name,
        targetPerMonth: link.frequency_per_month,
        bookingsThisMonth: 0,
        belowTarget: false,
        notificationSent: false,
        suggestedSlot: undefined as string | undefined,
      };

      try {
        // Count bookings this month for this friend link
        const { count, error: countError } = await supabase
          .from("fmcu_bookings")
          .select("id", { count: "exact", head: true })
          .eq("friend_link_id", link.id)
          .in("status", ["confirmed", "completed"])
          .gte("start_time", monthStart)
          .lte("start_time", monthEnd);

        if (countError) {
          console.error(`Count error for link ${link.id}:`, countError.message);
          results.push(result);
          continue;
        }

        result.bookingsThisMonth = count || 0;

        // Calculate if below target, accounting for how far through the month we are
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthProgress = dayOfMonth / daysInMonth;
        const expectedByNow = Math.floor(link.frequency_per_month * monthProgress);

        result.belowTarget = result.bookingsThisMonth < expectedByNow;

        // Also check: are there already future bookings scheduled this month?
        const { count: futureCount } = await supabase
          .from("fmcu_bookings")
          .select("id", { count: "exact", head: true })
          .eq("friend_link_id", link.id)
          .eq("status", "confirmed")
          .gte("start_time", now.toISOString())
          .lte("start_time", monthEnd);

        // If there are already future bookings, the user is on track
        if ((futureCount || 0) > 0) {
          result.belowTarget = false;
          results.push(result);
          continue;
        }

        if (!result.belowTarget) {
          results.push(result);
          continue;
        }

        // Find next available slot for the host
        const { data: availableSlots } = await supabase
          .from("fmcu_availability_slots")
          .select("id, start_time, end_time")
          .eq("user_id", link.user_id)
          .eq("is_booked", false)
          .gte("start_time", now.toISOString())
          .order("start_time", { ascending: true })
          .limit(5);

        // Get host name for the notification
        const { data: hostProfile } = await supabase
          .from("fmcu_profiles")
          .select("full_name")
          .eq("id", link.user_id)
          .single();

        const hostName = hostProfile?.full_name || "your friend";

        if (availableSlots && availableSlots.length > 0) {
          const suggestedSlot = availableSlots[0];
          result.suggestedSlot = suggestedSlot.start_time;

          // Format the slot time for display
          const slotDate = new Date(suggestedSlot.start_time);
          const formattedDate = slotDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const formattedTime = slotDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });

          // Send push to the guest (friend)
          try {
            await sendPushToUser(
              link.guest_user_id,
              "Time for a Catch-Up!",
              `Time to book your next catch-up with ${hostName}!`,
              {
                type: "rebooking_suggestion",
                friendLinkId: link.id,
                hostId: link.user_id,
                suggestedSlotId: suggestedSlot.id,
                suggestedTime: suggestedSlot.start_time,
                deepLink: `5mcu://book/${link.id}?slot=${suggestedSlot.id}`,
              },
            );
            result.notificationSent = true;
          } catch (pushErr) {
            console.error(
              `Failed to send rebooking push to ${link.guest_user_id}:`,
              (pushErr as Error).message,
            );
          }
        } else {
          // No available slots -- nudge the host to add availability
          try {
            await sendPushToUser(
              link.user_id,
              "Add Some Availability",
              `You're behind on catch-ups with ${link.friend_name} this month. Add some time slots!`,
              {
                type: "add_availability_nudge",
                friendLinkId: link.id,
                deepLink: "5mcu://availability",
              },
            );
            result.notificationSent = true;
          } catch (pushErr) {
            console.error(
              `Failed to send availability nudge to ${link.user_id}:`,
              (pushErr as Error).message,
            );
          }
        }
      } catch (e) {
        console.error(`Error processing friend link ${link.id}:`, e);
      }

      results.push(result);
    }

    const belowTargetCount = results.filter((r) => r.belowTarget).length;
    const notifiedCount = results.filter((r) => r.notificationSent).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} friend links. ${belowTargetCount} below target, ${notifiedCount} notifications sent.`,
        totalProcessed: results.length,
        belowTarget: belowTargetCount,
        notificationsSent: notifiedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auto-suggest-rebooking error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
