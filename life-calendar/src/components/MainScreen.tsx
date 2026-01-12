import { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { CalendarGrid } from './CalendarGrid';
import { EventDialog } from './EventDialog';
import { useAppData } from '../hooks/useAppData';
import type { DayEvent } from '../types';

export function MainScreen() {
  const {
    categories,
    events,
    loading,
    addEvent,
    deleteEvent,
    getEventsForDate,
  } = useAppData();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDate(null);
  };

  const handleSaveEvent = (eventData: Omit<DayEvent, 'id'>) => {
    const newEvent: DayEvent = {
      ...eventData,
      id: `${Date.now()}-${Math.random()}`,
    };
    addEvent(newEvent);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  const existingEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
    }}>
      <Container 
        maxWidth={false}
        sx={{ 
          py: { xs: 2, sm: 3 },
          px: { xs: 1, sm: 2, md: 3 },
          flexShrink: 0,
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
          }}
        >
          Events
        </Typography>
      </Container>
      <Box sx={{ 
        flex: 1,
        width: '100%',
        minHeight: 0,
        px: { xs: 1, sm: 2, md: 3 },
        pb: { xs: 1, sm: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
      }}>
        <CalendarGrid
          categories={categories}
          events={events}
          onDayClick={handleDayClick}
        />
      </Box>
      {selectedDate && (
        <EventDialog
          open={dialogOpen}
          date={selectedDate}
          categories={categories}
          existingEvents={existingEvents}
          onClose={handleCloseDialog}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </Box>
  );
}
