import type { LegendCategory, DayEvent } from '../types';

const CATEGORIES_KEY = 'life-calendar-categories';
const EVENTS_KEY = 'life-calendar-events';
const THEME_KEY = 'life-calendar-theme';

export type ThemeMode = 'light' | 'dark';

export const storage = {
  getCategories(): LegendCategory[] {
    try {
      const data = localStorage.getItem(CATEGORIES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCategories(categories: LegendCategory[]): void {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    } catch (error) {
      console.error('Failed to save categories:', error);
    }
  },

  getEvents(): DayEvent[] {
    try {
      const data = localStorage.getItem(EVENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveEvents(events: DayEvent[]): void {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  },

  getTheme(): ThemeMode {
    try {
      const data = localStorage.getItem(THEME_KEY);
      return (data === 'dark' || data === 'light') ? data : 'light';
    } catch {
      return 'light';
    }
  },

  saveTheme(theme: ThemeMode): void {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  },
};
