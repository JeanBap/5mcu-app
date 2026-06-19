import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface SendInviteRequest {
  friend_id: string;
  invite_method: "sms" | "whatsapp" | "email";
}

interface InviteResponse {
  invite_id: string;
  invite_code: string;
  invite_url: string;
  method: string;
  sms_body?: string;
  whatsapp_url?: string;
  email_sent?: boolean;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify JWT - extract user from Authorization header
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

    // Client with user's JWT for auth verification
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

    // Service role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: SendInviteRequest = await req.json();
    const { friend_id, invite_method } = body;

    if (!friend_id || !invite_method) {
      return new Response(
        JSON.stringify({ error: "friend_id and invite_method are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["sms", "whatsapp", "email"].includes(invite_method)) {
      return new Response(
        JSON.stringify({ error: "invite_method must be 'sms', 'whatsapp', or 'email'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify friend relationship exists
    const { data: friendLink, error: friendError } = await supabase
      .from("fmcu_friends")
      .select("id, friend_name, friend_phone, friend_email")
      .eq("id", friend_id)
      .eq("user_id", user.id)
      .single();

    if (friendError || !friendLink) {
      return new Response(
        JSON.stringify({ error: "Friend not found or not owned by you" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate unique invite code (retry if collision)
    let inviteCode: string;
    let attempts = 0;
    do {
      inviteCode = generateInviteCode();
      const { data: existing } = await supabase
        .from("fmcu_invites")
        .select("id")
        .eq("invite_code", inviteCode)
        .single();
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "Failed to generate unique invite code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inviteUrl = `https://5mcu.app/invite/${inviteCode}`;

    // Fetch inviter's profile for the message
    const { data: inviterProfile } = await supabase
      .from("fmcu_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || "Someone";

    // Create invite record
    const { data: invite, error: insertError } = await supabase
      .from("fmcu_invites")
      .insert({
        invite_code: inviteCode,
        from_user_id: user.id,
        to_friend_id: friendLink.id,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select("id")
      .single();

    if (insertError || !invite) {
      return new Response(
        JSON.stringify({ error: "Failed to create invite", details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageText =
      `${inviterName} wants to schedule a 5-minute video catch-up with you on 5MCU! Tap to join: ${inviteUrl}`;

    const result: InviteResponse = {
      invite_id: invite.id,
      invite_code: inviteCode,
      invite_url: inviteUrl,
      method: invite_method,
    };

    switch (invite_method) {
      case "sms": {
        result.sms_body = messageText;
        break;
      }
      case "whatsapp": {
        const phone = friendLink.friend_phone?.replace(/[^0-9]/g, "") || "";
        const encodedMessage = encodeURIComponent(messageText);
        result.whatsapp_url = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
        break;
      }
      case "email": {
        // If friend has an email, send via Supabase Auth admin or return template
        if (friendLink.friend_email) {
          // Use Supabase's built-in email via auth.admin or a custom SMTP setup
          // For now, return the email template for the client to send
          result.email_sent = false;

          // Attempt to send via edge function's SMTP if configured
          const smtpUrl = Deno.env.get("SMTP_SENDER_EMAIL");
          if (smtpUrl) {
            // In production, integrate with Resend, SendGrid, or Supabase SMTP
            console.log(`Would send email to ${friendLink.friend_email}`);
            result.email_sent = false; // Set to true when SMTP is wired
          }
        }
        break;
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
