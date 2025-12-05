import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { storage, STORAGE_KEY } from '../utils/storage';

export interface Habit {
  id: string;
  name: string;
  answers: Record<string, string>;
  createdAt: string;
}

interface HabitsContextType {
  habits: Habit[];
  addHabit: (name: string) => Habit;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  getHabit: (id: string) => Habit | undefined;
  isLoading: boolean;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHabits = async () => {
      try {
        const stored = await storage.getItem(STORAGE_KEY);
        if (stored) {
          setHabits(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load habits:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadHabits();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      storage.setItem(STORAGE_KEY, JSON.stringify(habits)).catch((error) => {
        console.error('Failed to save habits:', error);
      });
    }
  }, [habits, isLoading]);

  const addHabit = (name: string): Habit => {
    const newHabit: Habit = {
      id: Date.now().toString(),
      name,
      answers: {},
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, newHabit]);
    return newHabit;
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === id ? { ...habit, ...updates } : habit
      )
    );
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((habit) => habit.id !== id));
  };

  const getHabit = (id: string): Habit | undefined => {
    return habits.find((habit) => habit.id === id);
  };

  return (
    <HabitsContext.Provider
      value={{ habits, addHabit, updateHabit, deleteHabit, getHabit, isLoading }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits must be used within HabitsProvider');
  }
  return context;
}



