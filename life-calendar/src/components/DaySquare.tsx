import { Box, Tooltip, useTheme } from '@mui/material';
import type { DayEvent, LegendCategory } from '../types';

interface DaySquareProps {
  date: string;
  events: DayEvent[];
  categories: LegendCategory[];
  onClick: () => void;
  onDoubleClick: () => void;
  highlighted?: boolean;
}

export function DaySquare({ date, events, categories, onClick, onDoubleClick, highlighted = false }: DaySquareProps) {
  const theme = useTheme();
  
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
        onDoubleClick={onDoubleClick}
        sx={{
          width: '100%',
          aspectRatio: '1',
          border: highlighted 
            ? `2px solid ${theme.palette.primary.main}` 
            : `1px solid ${theme.palette.divider}`,
          borderRadius: { xs: '2px', sm: '3px' },
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: highlighted
            ? theme.palette.mode === 'dark'
              ? theme.palette.primary.dark + '40'
              : theme.palette.primary.light + '40'
            : theme.palette.mode === 'dark' 
              ? theme.palette.grey[800] 
              : theme.palette.grey[100],
          touchAction: 'auto',
          userSelect: 'none',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            borderWidth: '2px',
          },
          '&:active': {
            transform: 'scale(0.95)',
            transition: 'transform 0.1s',
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
                borderTop: index > 0 
                  ? `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` 
                  : 'none',
              }}
            />
          );
        })}
      </Box>
    </Tooltip>
  );
}
