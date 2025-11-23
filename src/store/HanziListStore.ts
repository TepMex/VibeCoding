import { HanziList } from "./types/HanziList";

const STORAGE_KEY = "hanzi_lists";

export class HanziListStore {
  private lists: HanziList[] = [];

  load(): HanziList[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.lists = JSON.parse(stored);
      } else {
        this.lists = [];
      }
      return [...this.lists];
    } catch (error) {
      console.error("Failed to load hanzi lists from localStorage:", error);
      this.lists = [];
      return [];
    }
  }

  save(lists: HanziList[]): void {
    try {
      this.lists = [...lists];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lists));
    } catch (error) {
      console.error("Failed to save hanzi lists to localStorage:", error);
      throw error;
    }
  }

  getLists(): HanziList[] {
    return [...this.lists];
  }
}

