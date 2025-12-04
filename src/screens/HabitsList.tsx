import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Fab,
  Typography,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useHabits } from '../contexts/HabitsContext';

export default function HabitsList() {
  const navigate = useNavigate();
  const { habits, addHabit } = useHabits();
  const [open, setOpen] = useState(false);
  const [habitName, setHabitName] = useState('');

  const handleOpenDialog = () => {
    setOpen(true);
    setHabitName('');
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setHabitName('');
  };

  const handleAddHabit = () => {
    if (habitName.trim()) {
      const newHabit = addHabit(habitName.trim());
      handleCloseDialog();
      navigate(`/questionnaire/${newHabit.id}`);
    }
  };

  const handleHabitClick = (habitId: string) => {
    navigate(`/questionnaire/${habitId}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && habitName.trim()) {
      handleAddHabit();
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Мои привычки
        </Typography>
        
        <List>
          {habits.map((habit) => (
            <ListItem key={habit.id} disablePadding>
              <ListItemButton onClick={() => handleHabitClick(habit.id)}>
                <ListItemText primary={habit.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {habits.length === 0 && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Пока нет привычек. Нажмите + чтобы добавить.
          </Typography>
        )}
      </Box>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleOpenDialog}
      >
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Новая привычка</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название привычки"
            fullWidth
            variant="outlined"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleAddHabit} variant="contained" disabled={!habitName.trim()}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

