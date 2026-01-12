import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { DayEvent, LegendCategory } from '../types';

interface EventDialogProps {
  open: boolean;
  date: string;
  categories: LegendCategory[];
  existingEvents: DayEvent[];
  onClose: () => void;
  onSave: (event: Omit<DayEvent, 'id'>) => void;
  onDelete: (eventId: string) => void;
}

export function EventDialog({
  open,
  date,
  categories,
  existingEvents,
  onClose,
  onSave,
  onDelete,
}: EventDialogProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryId = formData.get('categoryId') as string;
    const duration = formData.get('duration') as 'full' | 'half' | 'quarter';

    if (categoryId && duration) {
      onSave({
        date,
        categoryId,
        duration,
      });
      e.currentTarget.reset();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Event - {formatDate(date)}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Existing events for this day:
          </Typography>
          {existingEvents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No events yet
            </Typography>
          ) : (
            <List dense>
              {existingEvents.map((event) => {
                const category = categories.find((c) => c.id === event.categoryId);
                return (
                  <ListItem
                    key={event.id}
                    sx={{
                      borderLeft: `4px solid ${category?.color || '#e0e0e0'}`,
                      mb: 0.5,
                    }}
                  >
                    <ListItemText
                      primary={category?.name || 'Unknown'}
                      secondary={`${event.duration} day`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => onDelete(event.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        <Box component="form" id="event-form" onSubmit={handleSubmit}>
          <TextField
            select
            label="Category"
            name="categoryId"
            fullWidth
            required
            sx={{ mb: 2 }}
            defaultValue=""
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: category.color,
                    }}
                  />
                  {category.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Duration"
            name="duration"
            fullWidth
            required
            defaultValue=""
          >
            <MenuItem value="full">Whole day</MenuItem>
            <MenuItem value="half">Half a day</MenuItem>
            <MenuItem value="quarter">1/4 of day</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="event-form" variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
