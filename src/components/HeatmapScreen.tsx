import { useMemo, useState } from 'react';
import { Box, Typography, Container, TextField } from '@mui/material';

interface HeatmapScreenProps {
  text: string;
  exceptions: string;
}

export const HeatmapScreen = ({ text, exceptions }: HeatmapScreenProps) => {
  const [maxOccurrences, setMaxOccurrences] = useState(100);

  const coloredText = useMemo(() => {
    if (!text) return null;

    const exceptionSet = new Set(exceptions.split('').filter(char => char.trim()));
    const charOccurrences = new Map<string, number>();
    const charPositions: Array<{ char: string; occurrence: number }> = [];

    for (const char of text) {
      const currentCount = charOccurrences.get(char) || 0;
      const newCount = currentCount + 1;
      charOccurrences.set(char, newCount);
      charPositions.push({ char, occurrence: newCount });
    }

    return charPositions.map((item, index) => {
      if (exceptionSet.has(item.char)) {
        return (
          <span key={index} style={{ color: 'rgb(200, 200, 200)' }}>
            {item.char}
          </span>
        );
      }

      const normalizedValue = Math.min((item.occurrence - 1) / (maxOccurrences - 1), 1);
      
      const red = Math.round(255 - normalizedValue * 55);
      const green = Math.round(0 + normalizedValue * 200);
      const blue = Math.round(0 + normalizedValue * 200);
      
      const color = `rgb(${red}, ${green}, ${blue})`;

      return (
        <span key={index} style={{ color }}>
          {item.char}
        </span>
      );
    });
  }, [text, exceptions, maxOccurrences]);

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Hanzi Frequency Heatmap
      </Typography>
      
      <Box sx={{ mt: 2, mb: 3 }}>
        <TextField
          label="Max Occurrences (Light Gray)"
          type="number"
          value={maxOccurrences}
          onChange={(e) => setMaxOccurrences(Number(e.target.value) || 10)}
          inputProps={{ min: 2, step: 1 }}
          sx={{ width: 250 }}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography 
          component="div" 
          sx={{ 
            fontSize: '1.2rem', 
            fontFamily: 'serif', 
            lineHeight: 2,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        >
          {coloredText || 'No text to display. Please enter text first.'}
        </Typography>
      </Box>
    </Container>
  );
};

