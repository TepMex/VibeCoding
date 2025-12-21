import { franc } from 'franc';

// Top 50 world languages (excluding non-space-separated: Korean, Arabic, Japanese, Thai, Burmese, Hebrew)
export const LANGUAGES = [
  'chinese',
  'english',
  'hindi',
  'spanish',
  'french',
  'bengali',
  'portuguese',
  'russian',
  'punjabi',
  'german',
  'javanese',
  'indonesian',
  'telugu',
  'turkish',
  'vietnamese',
  'italian',
  'tamil',
  'urdu',
  'polish',
  'ukrainian',
  'gujarati',
  'kannada',
  'marathi',
  'oriya',
  'persian',
  'pashto',
  'romanian',
  'dutch',
  'greek',
  'czech',
  'swedish',
  'hungarian',
  'bulgarian',
  'serbian',
  'croatian',
  'slovak',
  'danish',
  'finnish',
  'norwegian',
  'catalan',
  'slovenian',
  'lithuanian',
  'latvian',
  'estonian',
  'swahili',
  'hausa',
  'yoruba',
  'igbo',
  'tagalog',
  'malayalam',
  'other'
] as const;

export type Language = (typeof LANGUAGES)[number];

// Map franc ISO 639-3 codes to our language identifiers
// Excluding: kor (Korean), ara (Arabic), jpn (Japanese), tha (Thai), mya (Burmese), heb (Hebrew)
const FRANC_TO_LANGUAGE: Record<string, Language> = {
  'cmn': 'chinese', // Mandarin Chinese
  'eng': 'english',
  'hin': 'hindi',
  'spa': 'spanish',
  'fra': 'french',
  'ben': 'bengali',
  'por': 'portuguese',
  'rus': 'russian',
  'pan': 'punjabi',
  'deu': 'german',
  'jav': 'javanese',
  'ind': 'indonesian',
  'tel': 'telugu',
  'tur': 'turkish',
  'vie': 'vietnamese',
  'ita': 'italian',
  'tam': 'tamil',
  'urd': 'urdu',
  'pol': 'polish',
  'ukr': 'ukrainian',
  'guj': 'gujarati',
  'kan': 'kannada',
  'mar': 'marathi',
  'ori': 'oriya',
  'pes': 'persian', // Western Persian
  'pbt': 'pashto',
  'ron': 'romanian',
  'nld': 'dutch',
  'ell': 'greek',
  'ces': 'czech',
  'swe': 'swedish',
  'hun': 'hungarian',
  'bul': 'bulgarian',
  'srp': 'serbian',
  'hrv': 'croatian',
  'slk': 'slovak',
  'dan': 'danish',
  'fin': 'finnish',
  'nob': 'norwegian', // Norwegian Bokmål
  'nno': 'norwegian', // Norwegian Nynorsk
  'cat': 'catalan',
  'slv': 'slovenian',
  'lit': 'lithuanian',
  'lav': 'latvian',
  'est': 'estonian',
  'swa': 'swahili',
  'hau': 'hausa',
  'yor': 'yoruba',
  'ibo': 'igbo',
  'tgl': 'tagalog',
  'mal': 'malayalam',
};

// Non-space-separated languages to exclude
const EXCLUDED_LANGUAGES = new Set(['kor', 'ara', 'jpn', 'tha', 'mya', 'heb']);

export function detectLanguage(text: string): Language {
  // Check for Chinese characters (Hanzi) - priority detection
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(text)) {
    return 'chinese';
  }

  // Use franc for language detection
  const detectedCode = franc(text);
  
  // If detection failed or language is excluded, try fallback heuristics
  if (!detectedCode || detectedCode === 'und' || EXCLUDED_LANGUAGES.has(detectedCode)) {
    // Fallback: Polish-specific characters
    const polishRegex = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    if (polishRegex.test(text)) {
      return 'polish';
    }
    
    // Default to English for space-separated languages
    return 'english';
  }

  // Map franc code to our language identifier
  const language = FRANC_TO_LANGUAGE[detectedCode];
  if (language) {
    return language;
  }

  // If language not in our supported list, default to English
  return 'english';
}

// Map our language identifiers to Google Translate language codes (ISO 639-1)
const LANGUAGE_TO_GOOGLE_CODE: Record<Language, string> = {
  'chinese': 'zh',
  'english': 'en',
  'hindi': 'hi',
  'spanish': 'es',
  'french': 'fr',
  'bengali': 'bn',
  'portuguese': 'pt',
  'russian': 'ru',
  'punjabi': 'pa',
  'german': 'de',
  'javanese': 'jv',
  'indonesian': 'id',
  'telugu': 'te',
  'turkish': 'tr',
  'vietnamese': 'vi',
  'italian': 'it',
  'tamil': 'ta',
  'urdu': 'ur',
  'polish': 'pl',
  'ukrainian': 'uk',
  'gujarati': 'gu',
  'kannada': 'kn',
  'marathi': 'mr',
  'oriya': 'or',
  'persian': 'fa',
  'pashto': 'ps',
  'romanian': 'ro',
  'dutch': 'nl',
  'greek': 'el',
  'czech': 'cs',
  'swedish': 'sv',
  'hungarian': 'hu',
  'bulgarian': 'bg',
  'serbian': 'sr',
  'croatian': 'hr',
  'slovak': 'sk',
  'danish': 'da',
  'finnish': 'fi',
  'norwegian': 'no',
  'catalan': 'ca',
  'slovenian': 'sl',
  'lithuanian': 'lt',
  'latvian': 'lv',
  'estonian': 'et',
  'swahili': 'sw',
  'hausa': 'ha',
  'yoruba': 'yo',
  'igbo': 'ig',
  'tagalog': 'tl',
  'malayalam': 'ml',
  'other': 'en', // Default to English for 'other'
};

export function getDictionaryUrl(language: Language, word: string): string {
  if (language === 'chinese') {
    return `plecoapi://x-callback-url/s?q=${encodeURIComponent(word)}`;
  }
  
  const languageCode = LANGUAGE_TO_GOOGLE_CODE[language] || 'en';
  return `https://translate.google.ru/?sl=${languageCode}&tl=en&text=${encodeURIComponent(word)}&op=translate`;
}

