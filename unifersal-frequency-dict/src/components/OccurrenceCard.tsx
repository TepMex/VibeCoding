import { Card, CardContent, Typography, IconButton, Box, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import type { Language } from '../utils/languageDetection';
import type { WordOccurrence } from '../utils/wordOccurrences';
import { highlightWordInSentence } from '../utils/wordOccurrences';
import { pinyin } from 'pinyin-pro';
import { segmentText } from '../utils/wordSegmentation';
import { loadAnkiSettings } from '../persistence/ankiSettingsStorage';
import { createCard } from '../clients/ankiConnect';

interface OccurrenceCardProps {
  occurrence: WordOccurrence;
  selectedWord: string;
  language: Language;
  hasNoUnknown: boolean;
  index: number;
  onCardCreating?: (isCreating: boolean) => void;
}

export const OccurrenceCard = ({
  occurrence,
  selectedWord,
  language,
  hasNoUnknown,
  index,
  onCardCreating,
}: OccurrenceCardProps) => {
  const highlightedSentence = highlightWordInSentence(
    occurrence.sentence,
    selectedWord,
    language
  );

  // Alternate background for visual separation
  const isEven = index % 2 === 0;
  const baseBackground = isEven 
    ? 'rgba(0, 0, 0, 0.02)' 
    : 'rgba(0, 0, 0, 0.04)';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(occurrence.sentence);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const convertChineseToPinyinWithSegmentation = async (text: string): Promise<string> => {
    // Segment the text into words
    const words = await segmentText(text, 'chinese');
    // Convert each word to pinyin with tone marks and join with spaces
    const pinyinWords = words.map(word => pinyin(word, { toneType: 'symbol' }));
    return pinyinWords.join(' ');
  };

  const handleCopyToAnki = async () => {
    try {
      let textToCopy = '';
      
      if (language === 'chinese') {
        // For Chinese: 4 columns - word, word pinyin, sentence, sentence pinyin
        // Use word segmentation and tone marks
        const wordPinyin = await convertChineseToPinyinWithSegmentation(selectedWord);
        const sentencePinyin = await convertChineseToPinyinWithSegmentation(occurrence.sentence);
        textToCopy = `${selectedWord}\t${wordPinyin}\t${occurrence.sentence}\t${sentencePinyin}`;
      } else {
        // For other languages: 2 columns - word, sentence
        textToCopy = `${selectedWord}\t${occurrence.sentence}`;
      }
      
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error('Failed to copy to Anki:', err);
    }
  };

  const handleCreateCardInAnki = async () => {
    try {
      onCardCreating?.(true);
      const settings = loadAnkiSettings();
      
      let wordPinyin = '';
      let sentencePinyin = '';
      
      if (language === 'chinese') {
        wordPinyin = await convertChineseToPinyinWithSegmentation(selectedWord);
        sentencePinyin = await convertChineseToPinyinWithSegmentation(occurrence.sentence);
      }
      
      const key = Math.floor(Date.now() / 1000).toString();
      
      await createCard({
        Key: key,
        Simplified: selectedWord,
        Pinyin: wordPinyin,
        Meaning: '',
        SentenceSimplified: occurrence.sentence,
        SentencePinyin: sentencePinyin,
        SentenceMeaning: '',
        deckName: settings.deckName,
        modelName: settings.modelName,
      });
    } catch (err) {
      console.error('Failed to create card in Anki:', err);
    } finally {
      onCardCreating?.(false);
    }
  };

  return (
    <Card 
      variant="elevation"
      elevation={2}
      sx={{
        backgroundColor: hasNoUnknown 
          ? 'rgba(76, 175, 80, 0.1)' 
          : baseBackground,
        border: '1px solid',
        borderColor: hasNoUnknown ? 'success.main' : 'divider',
        borderRadius: 2,
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          elevation: 4,
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', flex: 1 }}
            dangerouslySetInnerHTML={{ __html: highlightedSentence }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title="Copy sentence">
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy to Anki">
              <IconButton
                size="small"
                onClick={handleCopyToAnki}
                sx={{ 
                  color: 'text.secondary',
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Typography variant="button" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                  A
                </Typography>
              </IconButton>
            </Tooltip>
            <Tooltip title="Create card in Anki">
              <IconButton
                size="small"
                onClick={handleCreateCardInAnki}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <NoteAddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

