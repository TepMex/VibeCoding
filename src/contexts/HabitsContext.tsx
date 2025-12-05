import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

const STORAGE_KEY = 'habits-app-data';

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

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
      value={{ habits, addHabit, updateHabit, deleteHabit, getHabit }}
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



