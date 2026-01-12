import { useState, useEffect, useCallback } from 'react';
import type { LegendCategory, DayEvent } from '../types';
import { storage } from '../utils/storage';

export function useAppData() {
  const [categories, setCategories] = useState<LegendCategory[]>([]);
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadedCategories = storage.getCategories();
    const loadedEvents = storage.getEvents();

    if (loadedCategories.length === 0) {
      const defaultCategories: LegendCategory[] = [
        {
          id: '1',
          name: 'Work',
          description: 'Work-related activities',
          color: '#1976d2',
        },
        {
          id: '2',
          name: 'Personal',
          description: 'Personal activities',
          color: '#2e7d32',
        },
        {
          id: '3',
          name: 'Health',
          description: 'Health and fitness',
          color: '#d32f2f',
        },
      ];
      setCategories(defaultCategories);
      storage.saveCategories(defaultCategories);
    } else {
      setCategories(loadedCategories);
    }

    setEvents(loadedEvents);
    setLoading(false);
  }, []);

  const addCategory = useCallback((category: LegendCategory) => {
    setCategories((prev) => {
      const updated = [...prev, category];
      storage.saveCategories(updated);
      return updated;
    });
  }, []);

  const updateCategory = useCallback((id: string, category: LegendCategory) => {
    setCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? category : c));
      storage.saveCategories(updated);
      return updated;
    });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      storage.saveCategories(updated);
      return updated;
    });
    setEvents((prev) => {
      const updated = prev.filter((e) => e.categoryId !== id);
      storage.saveEvents(updated);
      return updated;
    });
  }, []);

  const addEvent = useCallback((event: DayEvent) => {
    setEvents((prev) => {
      const updated = [...prev, event];
      storage.saveEvents(updated);
      return updated;
    });
  }, []);

  const updateEvent = useCallback((id: string, event: DayEvent) => {
    setEvents((prev) => {
      const updated = prev.map((e) => (e.id === id ? event : e));
      storage.saveEvents(updated);
      return updated;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      storage.saveEvents(updated);
      return updated;
    });
  }, []);

  const getEventsForDate = useCallback(
    (date: string): DayEvent[] => {
      return events.filter((e) => e.date === date);
    },
    [events]
  );

  return {
    categories,
    events,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
  };
}
