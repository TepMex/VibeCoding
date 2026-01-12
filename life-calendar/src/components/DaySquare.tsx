import { Box, Tooltip } from '@mui/material';
import type { DayEvent, LegendCategory } from '../types';

interface DaySquareProps {
  date: string;
  events: DayEvent[];
  categories: LegendCategory[];
  onClick: () => void;
}

export function DaySquare({ date, events, categories, onClick }: DaySquareProps) {
  const getCategoryColor = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#e0e0e0';
  };

  const sortedEvents = [...events].sort((a, b) => {
    const order = { full: 0, half: 1, quarter: 2 };
    return order[a.duration] - order[b.duration];
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getEventHeight = (duration: 'full' | 'half' | 'quarter'): string => {
    if (duration === 'full') return '100%';
    if (duration === 'half') return '50%';
    return '25%';
  };

  const calculateTopPosition = (index: number, events: DayEvent[]): string => {
    let top = 0;
    for (let i = 0; i < index; i++) {
      const prevDuration = events[i].duration;
      if (prevDuration === 'full') top = 100;
      else if (prevDuration === 'half') top += 50;
      else top += 25;
    }
    return `${top}%`;
  };

  return (
    <Tooltip title={formatDate(date)}>
      <Box
        onClick={onClick}
        sx={{
          width: '100%',
          aspectRatio: '1',
          border: '1px solid #e0e0e0',
          borderRadius: '2px',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
          '&:hover': {
            borderColor: '#1976d2',
            borderWidth: '2px',
          },
        }}
      >
        {sortedEvents.map((event, index) => {
          const color = getCategoryColor(event.categoryId);
          const height = getEventHeight(event.duration);
          const top = calculateTopPosition(index, sortedEvents);

          return (
            <Box
              key={event.id}
              sx={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height,
                backgroundColor: color,
                borderTop: index > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
              }}
            />
          );
        })}
      </Box>
    </Tooltip>
  );
}
