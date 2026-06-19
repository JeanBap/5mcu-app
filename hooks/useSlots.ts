import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { AvailabilitySlot } from '@/types/database';
import { APP_CONFIG } from '@/constants/config';
import { useAuth } from './useAuth';

interface SlotsState {
  /** All availability slots for the current view month */
  slots: AvailabilitySlot[];
  /** Whether a slot operation is in progress */
  isLoading: boolean;
  /** Human-readable error from the last failed operation, null if none */
  error: string | null;
}

interface SlotsActions {
  /** Fetch all slots for the current user within a given month */
  fetchSlots: (month: Date) => Promise<void>;
  /** Create one or more new availability slots */
  createSlots: (slots: { start_time: string; end_time: string }[]) => Promise<AvailabilitySlot[]>;
  /** Delete an unbooked slot by ID */
  deleteSlot: (slotId: string) => Promise<void>;
  /** Get available (unbooked, future) slots for a specific user in a given month */
  getAvailableSlotsForFriend: (userId: string, month: Date) => Promise<AvailabilitySlot[]>;
  /** Generate and create 5-minute slots between two hours on a given date */
  createQuickSlots: (date: Date, startHour: number, endHour: number) => Promise<AvailabilitySlot[]>;
  /** Filter the current slots array to those on a specific date */
  getSlotsByDate: (date: Date) => AvailabilitySlot[];
}

/**
 * Calculate the start and end of a month in ISO string format.
 */
function getMonthBounds(month: Date): { start: string; end: string } {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0).toISOString();
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

/**
 * Availability slots store for the 5MCU app.
 *
 * Manages the user's 5-minute call availability windows.
 * Enforces free-tier limits on total slot count.
 *
 * @example
 * ```tsx
 * const { slots, fetchSlots, createQuickSlots } = useSlots();
 *
 * useEffect(() => {
 *   fetchSlots(new Date());
 * }, []);
 * ```
 */
export const useSlots = create<SlotsState & SlotsActions>()((set, get) => ({
  slots: [],
  isLoading: false,
  error: null,

  fetchSlots: async (month: Date) => {
    const { user } = useAuth.getState();
    if (!user) {
      set({ error: 'You must be signed in to view slots.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { start, end } = getMonthBounds(month);

      const { data, error } = await supabase
        .from('fmcu_availability_slots')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time', { ascending: true });

      if (error) {
        throw new Error(`Failed to load slots: ${error.message}`);
      }

      set({ slots: (data as AvailabilitySlot[]) ?? [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createSlots: async (newSlots: { start_time: string; end_time: string }[]) => {
    const { user, profile } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to create slots.');
    }

    set({ isLoading: true, error: null });
    try {
      const isPremium = profile?.is_premium === true;

      if (!isPremium) {
        const { count, error: countError } = await supabase
          .from('fmcu_availability_slots')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) {
          throw new Error(`Failed to check slot count: ${countError.message}`);
        }

        const currentCount = count ?? 0;
        if (currentCount + newSlots.length > APP_CONFIG.maxFreeSlots) {
          throw new Error(
            `Free accounts are limited to ${APP_CONFIG.maxFreeSlots} slots. ` +
            `You currently have ${currentCount} and are trying to add ${newSlots.length}. ` +
            `Upgrade to premium for unlimited slots.`
          );
        }
      }

      const slotsToInsert = newSlots.map((slot) => ({
        user_id: user.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: false,
      }));

      const { data, error } = await supabase
        .from('fmcu_availability_slots')
        .insert(slotsToInsert)
        .select();

      if (error) {
        throw new Error(`Failed to create slots: ${error.message}`);
      }

      const created = (data as AvailabilitySlot[]) ?? [];

      // Refresh the slots list for the month of the first new slot
      if (created.length > 0) {
        const firstSlotDate = new Date(created[0].start_time);
        await get().fetchSlots(firstSlotDate);
      }

      set({ isLoading: false });
      return created;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteSlot: async (slotId: string) => {
    const { user } = useAuth.getState();
    if (!user) {
      throw new Error('You must be signed in to delete slots.');
    }

    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('fmcu_availability_slots')
        .delete()
        .eq('id', slotId)
        .eq('user_id', user.id)
        .eq('is_booked', false);

      if (error) {
        throw new Error(`Failed to delete slot: ${error.message}`);
      }

      // Remove from local state immediately
      const currentSlots = get().slots;
      set({
        slots: currentSlots.filter((s) => s.id !== slotId),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getAvailableSlotsForFriend: async (userId: string, month: Date) => {
    try {
      const { start, end } = getMonthBounds(month);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('fmcu_availability_slots')
        .select('*')
        .eq('user_id', userId)
        .eq('is_booked', false)
        .gte('start_time', now > start ? now : start)
        .lte('start_time', end)
        .order('start_time', { ascending: true });

      if (error) {
        throw new Error(`Failed to load available slots: ${error.message}`);
      }

      return (data as AvailabilitySlot[]) ?? [];
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createQuickSlots: async (date: Date, startHour: number, endHour: number) => {
    const slotDuration = APP_CONFIG.slotDurationMinutes;
    const generatedSlots: { start_time: string; end_time: string }[] = [];

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    let currentMinute = startHour * 60;
    const endMinute = endHour * 60;

    while (currentMinute + slotDuration <= endMinute) {
      const startDate = new Date(year, month, day, 0, currentMinute);
      const endDate = new Date(year, month, day, 0, currentMinute + slotDuration);

      generatedSlots.push({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      currentMinute += slotDuration;
    }

    if (generatedSlots.length === 0) {
      throw new Error(
        'No slots could be generated for the given time range. ' +
        'Ensure the start hour is before the end hour with enough room for at least one 5-minute slot.'
      );
    }

    return get().createSlots(generatedSlots);
  },

  getSlotsByDate: (date: Date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    return get().slots.filter((slot) => {
      const slotDate = new Date(slot.start_time);
      return (
        slotDate.getFullYear() === targetYear &&
        slotDate.getMonth() === targetMonth &&
        slotDate.getDate() === targetDay
      );
    });
  },
}));
