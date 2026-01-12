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
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          m: { xs: 0, sm: 2 },
          maxHeight: { xs: '100%', sm: '90vh' },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: { xs: '1.125rem', sm: '1.25rem' },
          pb: { xs: 1, sm: 2 },
        }}
      >
        Add Event - {formatDate(date)}
      </DialogTitle>
      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 1, sm: 2 },
        }}
      >
        <Box sx={{ mb: { xs: 2, sm: 3 } }}>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              mb: 1,
            }}
          >
            Existing events for this day:
          </Typography>
          {existingEvents.length === 0 ? (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                fontStyle: 'italic',
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
              }}
            >
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
                      px: { xs: 1, sm: 2 },
                    }}
                  >
                    <ListItemText
                      primary={category?.name || 'Unknown'}
                      secondary={`${event.duration} day`}
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => onDelete(event.id)}
                        size="small"
                        sx={{
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: '1.125rem', sm: '1.25rem' },
                          },
                        }}
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
            sx={{ 
              mb: { xs: 2, sm: 2.5 },
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
            defaultValue=""
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: { xs: 14, sm: 16 },
                      height: { xs: 14, sm: 16 },
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
            sx={{
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
          >
            <MenuItem value="full">Whole day</MenuItem>
            <MenuItem value="half">Half a day</MenuItem>
            <MenuItem value="quarter">1/4 of day</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          gap: { xs: 1, sm: 2 },
        }}
      >
        <Button 
          onClick={onClose}
          sx={{
            fontSize: { xs: '0.875rem', sm: '1rem' },
          }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          form="event-form" 
          variant="contained"
          sx={{
            fontSize: { xs: '0.875rem', sm: '1rem' },
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
