import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';
import type { DayEvent, LegendCategory } from '../types';
import { DaySquare } from './DaySquare';

interface CalendarGridProps {
  categories: LegendCategory[];
  events: DayEvent[];
  onDayClick: (date: string) => void;
}

export function CalendarGrid({ categories, events, onDayClick }: CalendarGridProps) {
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 25);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 25);

    const weeksData: { date: string; month: string }[][] = [];
    let currentDate = new Date(startDate);
    let currentWeek: { date: string; month: string }[] = [];

    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    currentDate = new Date(startOfWeek);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const month = currentDate.toLocaleDateString('en-US', { month: 'short' });

      currentWeek.push({ date: dateStr, month });

      if (currentWeek.length === 7) {
        weeksData.push(currentWeek);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
        currentWeek.push({ date: dateStr, month });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeksData.push(currentWeek);
    }

    return weeksData;
  }, []);

  const monthHeaders = useMemo(() => {
    const headers: { weekIndex: number; month: string }[] = [];
    let lastMonth = '';

    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay.month !== lastMonth) {
        headers.push({ weekIndex, month: firstDay.month });
        lastMonth = firstDay.month;
      }
    });

    return headers;
  }, [weeks]);

  const getEventsForDate = (date: string): DayEvent[] => {
    return events.filter((e) => e.date === date);
  };

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 0.5,
          minWidth: 'fit-content',
        }}
      >
        {weeks.map((week, weekIndex) => {
          const monthHeader = monthHeaders.find((h) => h.weekIndex === weekIndex);
          return (
            <Box
              key={weekIndex}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                position: 'relative',
              }}
            >
              {monthHeader && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: -24,
                    left: 0,
                    fontWeight: 'bold',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {monthHeader.month}
                </Typography>
              )}
              {week.map((day) => (
                <Box
                  key={day.date}
                  sx={{
                    minWidth: { xs: '28px', sm: '36px', md: '44px' },
                    width: { xs: '28px', sm: '36px', md: '44px' },
                  }}
                >
                  <DaySquare
                    date={day.date}
                    events={getEventsForDate(day.date)}
                    categories={categories}
                    onClick={() => onDayClick(day.date)}
                  />
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
