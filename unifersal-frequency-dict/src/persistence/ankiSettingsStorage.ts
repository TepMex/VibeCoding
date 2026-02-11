const STORAGE_KEY = 'ankiSettings';

export interface AnkiSettings {
  deckName: string;
  modelName: string;
}

const DEFAULT_SETTINGS: AnkiSettings = {
  deckName: '',
  modelName: '',
};

export function loadAnkiSettings(): AnkiSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AnkiSettings;
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load Anki settings from localStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveAnkiSettings(settings: AnkiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save Anki settings to localStorage:', error);
  }
}



