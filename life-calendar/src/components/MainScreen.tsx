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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Events
      </Typography>
      <Box sx={{ mt: 3 }}>
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
    </Container>
  );
}
