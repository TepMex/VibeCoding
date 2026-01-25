import { Box, Typography, useTheme } from '@mui/material';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { DayEvent, LegendCategory } from '../types';
import { DaySquare } from './DaySquare';

interface CalendarGridProps {
  categories: LegendCategory[];
  events: DayEvent[];
  onDayClick: (date: string) => void;
  onDayDoubleClick: (date: string) => void;
  highlightedDate?: string | null;
  scrollToTodayRef?: React.RefObject<(() => void) | null>;
}

const DAYS_TO_LOAD = 50;
const WEEKS_TO_LOAD_AT_ONCE = 10;

function generateWeeks(startDate: Date, endDate: Date): { date: string; month: string }[][] {
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
}

export function CalendarGrid({ categories, events, onDayClick, onDayDoubleClick, highlightedDate, scrollToTodayRef }: CalendarGridProps) {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const maxFutureDate = useMemo(() => {
    const date = new Date(today);
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }, [today]);

  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(DAYS_TO_LOAD / 2));
    return date;
  });

  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + Math.floor(DAYS_TO_LOAD / 2));
    return date;
  });

  const weeks = useMemo(() => {
    return generateWeeks(startDate, endDate);
  }, [startDate, endDate]);

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

  const loadMorePast = useCallback(() => {
    setStartDate((prev) => {
      const newStart = new Date(prev);
      newStart.setDate(newStart.getDate() - (WEEKS_TO_LOAD_AT_ONCE * 7));
      return newStart;
    });
  }, []);

  const loadMoreFuture = useCallback(() => {
    setEndDate((prev) => {
      const newEnd = new Date(prev);
      const daysToAdd = WEEKS_TO_LOAD_AT_ONCE * 7;
      newEnd.setDate(newEnd.getDate() + daysToAdd);
      
      if (newEnd > maxFutureDate) {
        return maxFutureDate;
      }
      return newEnd;
    });
  }, [maxFutureDate]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;

    if (!container || !topSentinel || !bottomSentinel) {
      return;
    }

    const topObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePast();
        }
      },
      { root: container, rootMargin: '200px', threshold: 0.1 }
    );

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreFuture();
        }
      },
      { root: container, rootMargin: '200px', threshold: 0.1 }
    );

    topObserver.observe(topSentinel);
    bottomObserver.observe(bottomSentinel);

    return () => {
      topObserver.unobserve(topSentinel);
      bottomObserver.unobserve(bottomSentinel);
    };
  }, [loadMorePast, loadMoreFuture]);

  const hasInitializedScroll = useRef(false);

  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || weeks.length === 0) return;

    const todayDateStr = today.toISOString().split('T')[0];
    const todayWeekIndex = weeks.findIndex((week) =>
      week.some((day) => day.date === todayDateStr)
    );

    if (todayWeekIndex !== -1) {
      const weekHeight = container.scrollHeight / weeks.length;
      const targetScroll = todayWeekIndex * weekHeight - container.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [weeks, today]);

  useEffect(() => {
    if (scrollContainerRef.current && !hasInitializedScroll.current && weeks.length > 0) {
      const container = scrollContainerRef.current;
      const todayDateStr = today.toISOString().split('T')[0];
      const todayWeekIndex = weeks.findIndex((week) =>
        week.some((day) => day.date === todayDateStr)
      );

      if (todayWeekIndex !== -1) {
        setTimeout(() => {
          if (container && container.scrollHeight > 0) {
            const weekHeight = container.scrollHeight / weeks.length;
            const targetScroll = todayWeekIndex * weekHeight - container.clientHeight / 2;
            container.scrollTop = Math.max(0, targetScroll);
            hasInitializedScroll.current = true;
          }
        }, 0);
      }
    }
  }, [weeks, today]);

  useEffect(() => {
    if (scrollToTodayRef?.current !== undefined) {
      scrollToTodayRef.current = scrollToToday;
    }
  }, [scrollToToday, scrollToTodayRef]);

  const getEventsForDate = (date: string): DayEvent[] => {
    return events.filter((e) => e.date === date);
  };

  return (
    <Box 
      ref={scrollContainerRef}
      component="div"
      sx={{ 
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowX: 'hidden', 
        overflowY: 'auto',
        py: { xs: 1, sm: 2 },
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
        position: 'relative',
        '&::-webkit-scrollbar': {
          width: { xs: 6, sm: 8 },
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(255,255,255,0.05)' 
            : 'rgba(0,0,0,0.05)',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(255,255,255,0.2)' 
            : 'rgba(0,0,0,0.2)',
          borderRadius: 3,
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.3)' 
              : 'rgba(0,0,0,0.3)',
          },
        },
      }}
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 0.25, sm: 0.5 },
          width: '100%',
          pl: { xs: 5, sm: 6 },
          pr: { xs: 1, sm: 2 },
        }}
      >
        <Box ref={topSentinelRef} sx={{ width: '100%', height: '1px' }} />
        {weeks.map((week, weekIndex) => {
          const monthHeader = monthHeaders.find((h) => h.weekIndex === weekIndex);
          return (
            <Box
              key={`${week[0].date}-${weekIndex}`}
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: { xs: 0.25, sm: 0.5 },
                position: 'relative',
                width: '100%',
                alignItems: 'center',
              }}
            >
              {monthHeader && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    left: { xs: -45, sm: -55 },
                    fontWeight: 'bold',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    fontSize: { xs: '0.65rem', sm: '0.75rem' },
                    width: { xs: '40px', sm: '50px' },
                    textAlign: 'right',
                  }}
                >
                  {monthHeader.month}
                </Typography>
              )}
              {week.map((day) => (
                <Box
                  key={day.date}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <DaySquare
                    date={day.date}
                    events={getEventsForDate(day.date)}
                    categories={categories}
                    onClick={() => onDayClick(day.date)}
                    onDoubleClick={() => onDayDoubleClick(day.date)}
                    highlighted={highlightedDate === day.date}
                  />
                </Box>
              ))}
            </Box>
          );
        })}
        <Box ref={bottomSentinelRef} sx={{ width: '100%', height: '1px' }} />
      </Box>
    </Box>
  );
}
