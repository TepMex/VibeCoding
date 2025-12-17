import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Paper,
  Fab,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { MistakenPair } from '../types';
import { getPairs, updatePair, deletePair, addPair, clearHighscore } from '../utils/pairsStorage';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const [pairs, setPairs] = useState<MistakenPair[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showClearHighscoreDialog, setShowClearHighscoreDialog] = useState(false);
  const [editForm, setEditForm] = useState<MistakenPair>({
    hanzi1: '',
    pinyin1: '',
    hanzi2: '',
    pinyin2: '',
  });

  useEffect(() => {
    setPairs(getPairs());
  }, []);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setIsAdding(false);
    setEditForm(pairs[index]);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingIndex(null);
    setEditForm({ hanzi1: '', pinyin1: '', hanzi2: '', pinyin2: '' });
  };

  const handleDelete = (index: number) => {
    deletePair(index);
    setPairs(getPairs());
  };

  const handleSave = () => {
    if (isAdding) {
      addPair(editForm);
      setPairs(getPairs());
      setIsAdding(false);
      setEditForm({ hanzi1: '', pinyin1: '', hanzi2: '', pinyin2: '' });
    } else if (editingIndex !== null) {
      updatePair(editingIndex, editForm);
      setPairs(getPairs());
      setEditingIndex(null);
      setEditForm({ hanzi1: '', pinyin1: '', hanzi2: '', pinyin2: '' });
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setIsAdding(false);
    setEditForm({ hanzi1: '', pinyin1: '', hanzi2: '', pinyin2: '' });
  };

  const handleClearHighscore = () => {
    clearHighscore();
    setShowClearHighscoreDialog(false);
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          padding: 2,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Settings
        </Typography>

        <Paper>
          <List>
            {pairs.map((pair, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() => handleEdit(index)}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleDelete(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={`${pair.hanzi1} (${pair.pinyin1}) / ${pair.hanzi2} (${pair.pinyin2})`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={onBack}>
            Back
          </Button>
          <Button variant="outlined" color="error" onClick={() => setShowClearHighscoreDialog(true)}>
            Clear Highscores
          </Button>
        </Box>

        <Fab
          color="primary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={handleAdd}
        >
          <AddIcon />
        </Fab>

        <Dialog open={editingIndex !== null || isAdding} onClose={handleCancel} maxWidth="sm" fullWidth>
          <DialogTitle>{isAdding ? 'Add Pair' : 'Edit Pair'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Hanzi 1"
                value={editForm.hanzi1}
                onChange={(e) => setEditForm({ ...editForm, hanzi1: e.target.value })}
                fullWidth
              />
              <TextField
                label="Pinyin 1"
                value={editForm.pinyin1}
                onChange={(e) => setEditForm({ ...editForm, pinyin1: e.target.value })}
                fullWidth
              />
              <TextField
                label="Hanzi 2"
                value={editForm.hanzi2}
                onChange={(e) => setEditForm({ ...editForm, hanzi2: e.target.value })}
                fullWidth
              />
              <TextField
                label="Pinyin 2"
                value={editForm.pinyin2}
                onChange={(e) => setEditForm({ ...editForm, pinyin2: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={showClearHighscoreDialog} onClose={() => setShowClearHighscoreDialog(false)}>
          <DialogTitle>Clear Highscores</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to clear all highscores? This action cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowClearHighscoreDialog(false)}>Cancel</Button>
            <Button onClick={handleClearHighscore} variant="contained" color="error">
              Clear
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};



