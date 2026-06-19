import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Friend, Invite } from '@/types/database';
import { APP_CONFIG } from '@/constants/config';
import { useAuth } from './useAuth';

interface FriendsState {
  /** List of friends for the current user (excludes removed) */
  friends: Friend[];
  /** Whether a friends operation is in progress */
  isLoading: boolean;
  /** Human-readable error from the last failed operation, null if none */
  error: string | null;
}

interface FriendsActions {
  /** Fetch all friends for the current user (excludes removed) */
  fetchFriends: () => Promise<void>;
  /** Add a new friend with contact details and call frequency */
  addFriend: (name: string, phone: string, email: string, frequency: 1 | 2 | 4) => Promise<Friend>;
  /** Update the call frequency for a friend */
  updateFrequency: (friendId: string, frequency: 1 | 2 | 4) => Promise<void>;
  /** Soft-delete a friend by setting status to 'removed' */
  removeFriend: (friendId: string) => Promise<void>;
  /** Send an invite to a friend and return the invite with a shareable link */
  sendInvite: (friendId: string) => Promise<Invite & { shareableLink: string }>;
  /** Get the count of active (non-removed) friends */
  getFriendCount: () => number;
  /** Accept a pending invite by its invite code */
  acceptInvite: (inviteCode: string) => Promise<void>;
}

/**
 * Friends management store for the 5MCU app.
 *
 * Handles the friend list, invitations, and reciprocal friend linking.
 * Enforces free-tier limits on the number of friends.
 *
 * @example
 * ```tsx
 * const { friends, addFriend, sendInvite } = useFriends();
 *
 * useEffect(() => {
 *   fetchFriends();
 * }, []);
 * ```
 */
export const useFriends = create<FriendsState & FriendsActions>()((set, get) => ({
  friends: [],
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    const { user } = useAuth.getState();
    if (!user) {
      set({ error: 'You must be signed in to view friends.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error, count } = await supabase
        .from('fmcu_friends')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .neq('status', 'removed')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to load friends: ${error.message}`);
      }

      set({
        friends: (data as Friend[]) ?? [],
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addFriend: async (
    name: string,
    phone: string,
    email: string,
    frequency: 1 | 2 | 4
  ) => {
    const { user, profile } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to add friends.');
    }

    set({ isLoading: true, error: null });
    try {
      const isPremium = profile?.is_premium === true;
      const currentFriends = get().friends;

      if (!isPremium && currentFriends.length >= APP_CONFIG.maxFreeFriends) {
        throw new Error(
          `Free accounts are limited to ${APP_CONFIG.maxFreeFriends} friends. ` +
          `Upgrade to premium to add more friends.`
        );
      }

      const inviteCode = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const { data, error } = await supabase
        .from('fmcu_friends')
        .insert({
          user_id: user.id,
          name,
          phone,
          email,
          frequency,
          status: 'pending',
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add friend: ${error.message}`);
      }

      const newFriend = data as Friend;

      // Refresh the full list to keep state consistent
      await get().fetchFriends();

      set({ isLoading: false });
      return newFriend;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateFrequency: async (friendId: string, frequency: 1 | 2 | 4) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to update friend frequency.');
    }

    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('fmcu_friends')
        .update({ frequency, updated_at: new Date().toISOString() })
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to update frequency: ${error.message}`);
      }

      await get().fetchFriends();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  removeFriend: async (friendId: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to remove friends.');
    }

    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('fmcu_friends')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to remove friend: ${error.message}`);
      }

      await get().fetchFriends();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  sendInvite: async (friendId: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to send invites.');
    }

    set({ isLoading: true, error: null });
    try {
      // Get the friend record to access contact info and invite code
      const friend = get().friends.find((f) => f.id === friendId);
      if (!friend) {
        throw new Error('Friend not found. Please refresh your friends list.');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { data, error } = await supabase
        .from('fmcu_invites')
        .insert({
          from_user_id: user.id,
          to_email: friend.email,
          to_phone: friend.phone,
          friend_link_id: friend.id,
          invite_code: friend.invite_code,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invite: ${error.message}`);
      }

      const invite = data as Invite;
      const shareableLink = `https://5mcu.app/invite/${friend.invite_code}`;

      set({ isLoading: false });
      return { ...invite, shareableLink };
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getFriendCount: () => {
    return get().friends.filter((f) => f.status !== 'removed').length;
  },

  acceptInvite: async (inviteCode: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to accept an invite.');
    }

    set({ isLoading: true, error: null });
    try {
      // Find the pending invite by code
      const { data: invite, error: inviteError } = await supabase
        .from('fmcu_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        throw new Error(
          'This invite is no longer valid. It may have expired or already been accepted.'
        );
      }

      // Check if the invite has expired
      if (new Date(invite.expires_at) < new Date()) {
        throw new Error(
          'This invite has expired. Ask your friend to send a new one.'
        );
      }

      // Update the invite status to accepted
      const { error: updateInviteError } = await supabase
        .from('fmcu_invites')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (updateInviteError) {
        throw new Error(`Failed to accept invite: ${updateInviteError.message}`);
      }

      // Update the original friend record to link to the accepting user
      const { data: friendRecord, error: friendFetchError } = await supabase
        .from('fmcu_friends')
        .select('*')
        .eq('id', invite.friend_link_id)
        .single();

      if (friendFetchError || !friendRecord) {
        throw new Error('Could not find the associated friend record.');
      }

      const { error: friendUpdateError } = await supabase
        .from('fmcu_friends')
        .update({
          friend_user_id: user.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invite.friend_link_id);

      if (friendUpdateError) {
        throw new Error(`Failed to link friend: ${friendUpdateError.message}`);
      }

      // Create a reciprocal friend record for the accepting user
      const reciprocalInviteCode = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const { error: reciprocalError } = await supabase
        .from('fmcu_friends')
        .insert({
          user_id: user.id,
          friend_user_id: invite.from_user_id,
          name: friendRecord.name,
          phone: friendRecord.phone ?? '',
          email: friendRecord.email ?? '',
          frequency: friendRecord.frequency,
          status: 'active',
          invite_code: reciprocalInviteCode,
        });

      if (reciprocalError) {
        console.error('Failed to create reciprocal friend record:', reciprocalError.message);
        // Non-fatal: the main link is established even if the reciprocal fails
      }

      await get().fetchFriends();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
