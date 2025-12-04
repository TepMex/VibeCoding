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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface Habit {
  id: string;
  name: string;
}

export default function HabitsList() {
  const navigate = useNavigate();
  const [habits, setHabits] = useState<Habit[]>([]);

  const handleAddHabit = () => {
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: `Habit ${habits.length + 1}`,
    };
    setHabits([...habits, newHabit]);
  };

  const handleHabitClick = (habitId: string) => {
    navigate(`/questionnaire/${habitId}`);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Habits
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
            No habits yet. Click the + button to add one.
          </Typography>
        )}
      </Box>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddHabit}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
}

