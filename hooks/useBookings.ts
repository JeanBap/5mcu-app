import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types/database';
import { useAuth } from './useAuth';
import {
  scheduleCallReminder,
  scheduleCallEndAlert,
  cancelNotifications,
} from '@/lib/notifications';

interface BookingsState {
  /** List of upcoming bookings for the current user */
  bookings: Booking[];
  /** Whether a booking operation is in progress */
  isLoading: boolean;
  /** Human-readable error from the last failed operation, null if none */
  error: string | null;
}

interface BookingsActions {
  /** Fetch all upcoming scheduled bookings for the current user */
  fetchUpcomingBookings: () => Promise<void>;
  /** Create a new booking for a slot with a specific friend */
  createBooking: (slotId: string, friendLinkId: string) => Promise<Booking>;
  /** Cancel a booking and free up the associated slot */
  cancelBooking: (bookingId: string) => Promise<void>;
  /** Mark a booking as completed */
  completeBooking: (bookingId: string) => Promise<void>;
  /** Get the next upcoming booking */
  getNextBooking: () => Booking | null;
  /** Get all bookings scheduled for today */
  getTodaysBookings: () => Booking[];
}

/**
 * Generate a Jitsi Meet room URL using a unique random room name.
 */
function generateJitsiUrl(): string {
  const roomId = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `https://meet.jit.si/5mcu-${roomId}-${timestamp}`;
}

/**
 * Bookings store for the 5MCU app.
 *
 * Manages call bookings, including creation with automatic
 * notification scheduling, cancellation, and completion tracking.
 *
 * @example
 * ```tsx
 * const { bookings, createBooking, getNextBooking } = useBookings();
 *
 * useEffect(() => {
 *   fetchUpcomingBookings();
 * }, []);
 * ```
 */
export const useBookings = create<BookingsState & BookingsActions>()((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,

  fetchUpcomingBookings: async () => {
    const { user } = useAuth.getState();
    if (!user) {
      set({ error: 'You must be signed in to view bookings.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('fmcu_bookings')
        .select(`
          *,
          friend:fmcu_friends!friend_link_id (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('booker_id', user.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to load bookings: ${error.message}`);
      }

      set({ bookings: (data as Booking[]) ?? [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createBooking: async (slotId: string, friendLinkId: string) => {
    const { user, profile } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to create bookings.');
    }

    set({ isLoading: true, error: null });
    try {
      // Get the slot details for the scheduled time
      const { data: slot, error: slotError } = await supabase
        .from('fmcu_availability_slots')
        .select('*')
        .eq('id', slotId)
        .single();

      if (slotError || !slot) {
        throw new Error('The selected time slot could not be found. It may have been removed.');
      }

      if (slot.is_booked) {
        throw new Error('This time slot has already been booked. Please choose another.');
      }

      // Determine video app and URL
      const videoApp = profile?.preferred_video_app ?? 'jitsi';
      let videoUrl: string | null = null;

      if (videoApp === 'jitsi') {
        videoUrl = generateJitsiUrl();
      }
      // For other apps (zoom, facetime, etc.), the user provides their own link
      // or the app is opened directly on the device

      // Insert the booking
      const { data: booking, error: bookingError } = await supabase
        .from('fmcu_bookings')
        .insert({
          slot_id: slotId,
          booker_id: user.id,
          friend_link_id: friendLinkId,
          status: 'scheduled',
          video_app: videoApp,
          video_url: videoUrl,
          scheduled_at: slot.start_time,
        })
        .select()
        .single();

      if (bookingError) {
        throw new Error(`Failed to create booking: ${bookingError.message}`);
      }

      // Mark the slot as booked
      const { error: slotUpdateError } = await supabase
        .from('fmcu_availability_slots')
        .update({ is_booked: true })
        .eq('id', slotId);

      if (slotUpdateError) {
        console.error('Failed to mark slot as booked:', slotUpdateError.message);
        // Non-fatal: the booking exists, slot status is a secondary concern
      }

      const createdBooking = booking as Booking;
      const scheduledTime = new Date(slot.start_time);

      // Schedule call reminder notification (e.g. 1 minute before)
      try {
        await scheduleCallReminder({
          bookingId: createdBooking.id,
          scheduledAt: scheduledTime,
          friendLinkId,
        });
      } catch (notifError) {
        console.error('Failed to schedule call reminder:', notifError);
      }

      // Schedule call end alert
      // Check if there is a next booking after this one to pass hasNextCall
      try {
        const currentBookings = get().bookings;
        const endTime = new Date(slot.end_time);
        const hasNextCall = currentBookings.some(
          (b) => new Date(b.scheduled_at) > endTime
        );

        await scheduleCallEndAlert({
          bookingId: createdBooking.id,
          endAt: endTime,
          hasNextCall,
        });
      } catch (notifError) {
        console.error('Failed to schedule call end alert:', notifError);
      }

      // Refresh the bookings list
      await get().fetchUpcomingBookings();

      set({ isLoading: false });
      return createdBooking;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  cancelBooking: async (bookingId: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to cancel bookings.');
    }

    set({ isLoading: true, error: null });
    try {
      // Get the booking to find the associated slot
      const { data: booking, error: fetchError } = await supabase
        .from('fmcu_bookings')
        .select('*')
        .eq('id', bookingId)
        .eq('booker_id', user.id)
        .single();

      if (fetchError || !booking) {
        throw new Error('Booking not found or you do not have permission to cancel it.');
      }

      // Update booking status to cancelled
      const { error: cancelError } = await supabase
        .from('fmcu_bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (cancelError) {
        throw new Error(`Failed to cancel booking: ${cancelError.message}`);
      }

      // Free up the slot
      const { error: slotError } = await supabase
        .from('fmcu_availability_slots')
        .update({ is_booked: false })
        .eq('id', booking.slot_id);

      if (slotError) {
        console.error('Failed to free up slot:', slotError.message);
      }

      // Cancel associated notifications
      try {
        await cancelNotifications(bookingId);
      } catch (notifError) {
        console.error('Failed to cancel notifications:', notifError);
      }

      // Refresh the bookings list
      await get().fetchUpcomingBookings();

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  completeBooking: async (bookingId: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to complete bookings.');
    }

    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('fmcu_bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('booker_id', user.id);

      if (error) {
        throw new Error(`Failed to complete booking: ${error.message}`);
      }

      // Refresh to remove from the upcoming list
      await get().fetchUpcomingBookings();

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getNextBooking: () => {
    const bookings = get().bookings;
    if (bookings.length === 0) {
      return null;
    }
    // Bookings are already sorted by scheduled_at ascending from fetchUpcomingBookings
    return bookings[0];
  },

  getTodaysBookings: () => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    return get().bookings.filter((booking) => {
      const bookingDate = new Date(booking.scheduled_at);
      return (
        bookingDate.getFullYear() === todayYear &&
        bookingDate.getMonth() === todayMonth &&
        bookingDate.getDate() === todayDay
      );
    });
  },
}));
