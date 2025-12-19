import { segmentText } from '../utils/wordSegmentation';
import { calculateWordFrequencies, type WordFrequency } from '../utils/frequencyAnalysis';
import type { Language } from '../utils/languageDetection';

export interface WorkerMessage {
  type: 'process';
  text: string;
  language: Language;
}

export interface WorkerResponse {
  type: 'result' | 'error';
  frequencies?: WordFrequency[];
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, text, language } = e.data;

  if (type === 'process') {
    try {
      const words = await segmentText(text, language);
      const frequencies = calculateWordFrequencies(words);
      
      const response: WorkerResponse = {
        type: 'result',
        frequencies,
      };
      
      self.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to process text',
      };
      
      self.postMessage(response);
    }
  }
};







