import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Send a push notification via Expo Push API.
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<ExpoPushTicket> {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) {
    throw new Error(`Invalid Expo push token: ${pushToken}`);
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
    channelId: "default",
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Expo Push API error (${response.status}): ${errorText}`,
    );
  }

  const result = await response.json();
  return result.data as ExpoPushTicket;
}

/**
 * Send a push notification to a user by looking up their push token from the profiles table.
 * Returns null if user has no push token (notification silently skipped).
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<ExpoPushTicket | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("push_token, full_name")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch profile for user ${userId}: ${error.message}`);
  }

  if (!profile?.push_token) {
    console.warn(`User ${userId} has no push token, skipping notification`);
    return null;
  }

  return sendPushNotification(profile.push_token, title, body, data);
}

/**
 * Send push notifications to multiple users in a batch (max 100 per Expo API call).
 */
export async function sendPushBatch(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  // Expo recommends max 100 per request
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const allTickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Expo Push API batch error (${response.status}): ${errorText}`,
      );
    }

    const result = await response.json();
    allTickets.push(...(result.data as ExpoPushTicket[]));
  }

  return allTickets;
}
