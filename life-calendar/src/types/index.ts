export interface LegendCategory {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface DayEvent {
  id: string;
  date: string; // YYYY-MM-DD
  categoryId: string;
  duration: 'full' | 'half' | 'quarter' | 'eighth';
}
