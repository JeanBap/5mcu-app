import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * RevenueCat webhook handler.
 * Receives subscription lifecycle events and updates the database.
 *
 * RevenueCat webhook URL: <SUPABASE_URL>/functions/v1/webhook-revenuecat
 * Set REVENUECAT_WEBHOOK_AUTH_KEY in Supabase secrets.
 *
 * Events handled:
 * - INITIAL_PURCHASE: New subscription
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: Subscription cancelled (still active until period end)
 * - EXPIRATION: Subscription expired (access revoked)
 * - PRODUCT_CHANGE: Plan upgrade/downgrade
 * - BILLING_ISSUE: Payment failed
 * - SUBSCRIBER_ALIAS: User alias created
 */

interface RevenueCatEvent {
  type: string;
  id: string;
  event_timestamp_ms: number;
  app_user_id: string;
  aliases: string[];
  original_app_user_id: string;
  product_id: string;
  entitlement_ids: string[];
  period_type: string; // "NORMAL" | "TRIAL" | "INTRO"
  purchased_at_ms: number;
  expiration_at_ms: number | null;
  store: string; // "APP_STORE" | "PLAY_STORE" | "STRIPE"
  environment: string; // "SANDBOX" | "PRODUCTION"
  is_family_share: boolean;
  currency: string;
  price_in_purchased_currency: number;
  subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
  transaction_id: string;
  original_transaction_id: string;
  cancellation_reason?: string;
  price?: number;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify webhook authentication
    const webhookAuthKey = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_KEY");
    if (webhookAuthKey) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader !== `Bearer ${webhookAuthKey}`) {
        console.error("Invalid webhook auth key");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: RevenueCatWebhookPayload = await req.json();
    const event = payload.event;

    if (!event || !event.type) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`RevenueCat event: ${event.type} for user ${event.app_user_id}`);

    // Skip sandbox events in production (optional, configure via env)
    const skipSandbox = Deno.env.get("SKIP_SANDBOX_EVENTS") === "true";
    if (skipSandbox && event.environment === "SANDBOX") {
      return new Response(
        JSON.stringify({ message: "Sandbox event skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the Supabase user ID from RevenueCat's app_user_id
    // RevenueCat stores the Supabase auth UUID as the app_user_id
    const userId = event.app_user_id;

    // Check if user exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, is_premium")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      // Try aliases
      let resolvedUserId: string | null = null;
      for (const alias of event.aliases || []) {
        const { data: aliasProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", alias)
          .single();
        if (aliasProfile) {
          resolvedUserId = aliasProfile.id;
          break;
        }
      }

      if (!resolvedUserId) {
        console.error(`User not found: ${userId}, aliases: ${event.aliases?.join(", ")}`);
        // Return 200 to prevent RevenueCat retries -- user might not exist yet
        return new Response(
          JSON.stringify({ message: "User not found, event logged" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const resolvedUserId = profile?.id || userId;

    // Process based on event type
    switch (event.type) {
      case "INITIAL_PURCHASE": {
        // New subscription -- create or update subscription record
        await supabase.from("subscriptions").upsert(
          {
            user_id: resolvedUserId,
            revenuecat_id: event.original_transaction_id,
            product_id: event.product_id,
            store: event.store,
            status: "active",
            period_type: event.period_type,
            purchased_at: new Date(event.purchased_at_ms).toISOString(),
            expires_at: event.expiration_at_ms
              ? new Date(event.expiration_at_ms).toISOString()
              : null,
            currency: event.currency,
            price: event.price_in_purchased_currency,
            entitlements: event.entitlement_ids,
            environment: event.environment,
            is_family_share: event.is_family_share,
          },
          { onConflict: "user_id" },
        );

        // Set premium flag
        await supabase
          .from("profiles")
          .update({ is_premium: true })
          .eq("id", resolvedUserId);

        console.log(`INITIAL_PURCHASE: ${resolvedUserId} -> premium`);
        break;
      }

      case "RENEWAL": {
        // Subscription renewed
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            expires_at: event.expiration_at_ms
              ? new Date(event.expiration_at_ms).toISOString()
              : null,
            purchased_at: new Date(event.purchased_at_ms).toISOString(),
            price: event.price_in_purchased_currency,
          })
          .eq("user_id", resolvedUserId);

        await supabase
          .from("profiles")
          .update({ is_premium: true })
          .eq("id", resolvedUserId);

        console.log(`RENEWAL: ${resolvedUserId} renewed`);
        break;
      }

      case "CANCELLATION": {
        // Subscription cancelled but still active until expiration
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancellation_reason: event.cancellation_reason || null,
          })
          .eq("user_id", resolvedUserId);

        // User remains premium until expiration_at
        // is_premium stays true; EXPIRATION event will flip it
        console.log(`CANCELLATION: ${resolvedUserId} cancelled (active until expiry)`);
        break;
      }

      case "EXPIRATION": {
        // Subscription expired -- revoke access
        await supabase
          .from("subscriptions")
          .update({
            status: "expired",
            expires_at: event.expiration_at_ms
              ? new Date(event.expiration_at_ms).toISOString()
              : new Date().toISOString(),
          })
          .eq("user_id", resolvedUserId);

        await supabase
          .from("profiles")
          .update({ is_premium: false })
          .eq("id", resolvedUserId);

        console.log(`EXPIRATION: ${resolvedUserId} -> free tier`);
        break;
      }

      case "PRODUCT_CHANGE": {
        // Plan change (upgrade/downgrade)
        await supabase
          .from("subscriptions")
          .update({
            product_id: event.product_id,
            status: "active",
            expires_at: event.expiration_at_ms
              ? new Date(event.expiration_at_ms).toISOString()
              : null,
          })
          .eq("user_id", resolvedUserId);

        console.log(`PRODUCT_CHANGE: ${resolvedUserId} -> ${event.product_id}`);
        break;
      }

      case "BILLING_ISSUE": {
        // Payment failure -- mark as billing issue but don't revoke yet
        await supabase
          .from("subscriptions")
          .update({ status: "billing_issue" })
          .eq("user_id", resolvedUserId);

        console.log(`BILLING_ISSUE: ${resolvedUserId}`);
        break;
      }

      case "SUBSCRIBER_ALIAS": {
        // User alias created -- log it
        console.log(
          `SUBSCRIBER_ALIAS: ${event.original_app_user_id} -> ${event.app_user_id}`,
        );
        break;
      }

      default: {
        console.log(`Unhandled RevenueCat event type: ${event.type}`);
      }
    }

    // Log the event for audit trail
    await supabase.from("subscription_events").insert({
      user_id: resolvedUserId,
      event_type: event.type,
      event_id: event.id,
      product_id: event.product_id,
      store: event.store,
      environment: event.environment,
      raw_event: event,
      created_at: new Date(event.event_timestamp_ms).toISOString(),
    });

    return new Response(
      JSON.stringify({ message: "Webhook processed", event_type: event.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("webhook-revenuecat error:", err);
    // Return 200 even on errors to prevent RevenueCat retry storms
    // Errors are logged for investigation
    return new Response(
      JSON.stringify({
        message: "Webhook received with processing error",
        error: (err as Error).message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
