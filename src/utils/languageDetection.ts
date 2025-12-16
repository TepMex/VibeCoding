export const LANGUAGES = ['chinese', 'english', 'polish', 'other'] as const;
export type Language = (typeof LANGUAGES)[number];

export function detectLanguage(text: string): Language {
  // Check for Chinese characters (Hanzi)
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(text)) {
    return 'chinese';
  }

  // Simple heuristics for other languages
  // Polish-specific characters: ą, ć, ę, ł, ń, ó, ś, ź, ż
  const polishRegex = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  if (polishRegex.test(text)) {
    return 'polish';
  }

  // Default to English for space-separated languages
  return 'english';
}

