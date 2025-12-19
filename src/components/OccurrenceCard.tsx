import { Card, CardContent, Typography } from '@mui/material';
import type { Language } from '../utils/languageDetection';
import type { WordOccurrence } from '../utils/wordOccurrences';
import { highlightWordInSentence } from '../utils/wordOccurrences';

interface OccurrenceCardProps {
  occurrence: WordOccurrence;
  selectedWord: string;
  language: Language;
  hasNoUnknown: boolean;
  index: number;
}

export const OccurrenceCard = ({
  occurrence,
  selectedWord,
  language,
  hasNoUnknown,
  index,
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
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: highlightedSentence }}
        />
      </CardContent>
    </Card>
  );
};

