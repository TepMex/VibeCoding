import { Chip, Stack, Paper, Typography } from '@mui/material';
import type { Language } from '../utils/languageDetection';

export interface CategoryCounts {
  frequent: number;
  rare: number;
  knownHanzi: number;
  known: number;
}

export interface CategoryFilters {
  showFrequent: boolean;
  showRare: boolean;
  showKnownHanzi: boolean;
  showKnown: boolean;
}

interface LegendFilterProps {
  language: Language;
  categoryCounts: CategoryCounts;
  filters: CategoryFilters;
  onFilterChange: (filters: CategoryFilters) => void;
  additionalInfo?: React.ReactNode;
}

export const LegendFilter = ({
  language,
  categoryCounts,
  filters,
  onFilterChange,
  additionalInfo,
}: LegendFilterProps) => {
  const handleFrequentToggle = () => {
    onFilterChange({ ...filters, showFrequent: !filters.showFrequent });
  };

  const handleRareToggle = () => {
    onFilterChange({ ...filters, showRare: !filters.showRare });
  };

  const handleKnownHanziToggle = () => {
    onFilterChange({ ...filters, showKnownHanzi: !filters.showKnownHanzi });
  };

  const handleKnownToggle = () => {
    onFilterChange({ ...filters, showKnown: !filters.showKnown });
  };

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
      <Typography variant="caption" component="div" sx={{ mb: 1 }}>
        <strong>Legend:</strong>
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Chip
          label={`Frequent (≥5 occurrences) (${categoryCounts.frequent})`}
          color="success"
          size="small"
          variant={filters.showFrequent ? 'filled' : 'outlined'}
          onClick={handleFrequentToggle}
          sx={{
            cursor: 'pointer',
            opacity: filters.showFrequent ? 1 : 0.6,
            '&:hover': {
              opacity: filters.showFrequent ? 0.9 : 0.8,
            },
          }}
        />
        <Chip
          label={`Rare (<5 occurrences) (${categoryCounts.rare})`}
          color="error"
          size="small"
          variant={filters.showRare ? 'filled' : 'outlined'}
          onClick={handleRareToggle}
          sx={{
            cursor: 'pointer',
            opacity: filters.showRare ? 1 : 0.6,
            '&:hover': {
              opacity: filters.showRare ? 0.9 : 0.8,
            },
          }}
        />
        {language === 'chinese' && (
          <Chip
            label={`Contains known hanzi (${categoryCounts.knownHanzi})`}
            size="small"
            variant={filters.showKnownHanzi ? 'filled' : 'outlined'}
            onClick={handleKnownHanziToggle}
            sx={{
              cursor: 'pointer',
              backgroundColor: filters.showKnownHanzi ? 'rgba(128, 128, 128, 0.4)' : 'transparent',
              color: 'text.primary',
              opacity: filters.showKnownHanzi ? 1 : 0.6,
              borderColor: filters.showKnownHanzi ? 'rgba(128, 128, 128, 0.4)' : 'divider',
              '&:hover': {
                opacity: filters.showKnownHanzi ? 0.9 : 0.8,
                backgroundColor: filters.showKnownHanzi ? 'rgba(128, 128, 128, 0.5)' : 'rgba(128, 128, 128, 0.1)',
              },
            }}
          />
        )}
        <Chip
          label={`Known (in exclusion list) (${categoryCounts.known})`}
          size="small"
          variant="outlined"
          onClick={handleKnownToggle}
          sx={{
            cursor: 'pointer',
            opacity: filters.showKnown ? 1 : 0.6,
            borderColor: 'divider',
            borderWidth: 1,
            borderStyle: 'solid',
            '&:hover': {
              opacity: filters.showKnown ? 0.9 : 0.8,
              backgroundColor: filters.showKnown ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.02)',
            },
          }}
        />
      </Stack>
      {additionalInfo && (
        <Typography variant="caption" component="div" sx={{ mt: 1, color: 'text.secondary' }}>
          {additionalInfo}
        </Typography>
      )}
    </Paper>
  );
};










