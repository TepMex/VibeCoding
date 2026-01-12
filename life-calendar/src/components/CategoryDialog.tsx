import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from '@mui/material';
import { useState, useEffect } from 'react';
import type { LegendCategory } from '../types';

interface CategoryDialogProps {
  open: boolean;
  category: LegendCategory | null;
  onClose: () => void;
  onSave: (category: LegendCategory) => void;
}

export function CategoryDialog({ open, category, onSave, onClose }: CategoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1976d2');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description);
      setColor(category.color);
    } else {
      setName('');
      setDescription('');
      setColor('#1976d2');
    }
  }, [category, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && color) {
      const categoryData: LegendCategory = {
        id: category?.id || `${Date.now()}-${Math.random()}`,
        name: name.trim(),
        description: description.trim(),
        color,
      };
      onSave(categoryData);
      handleClose();
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setColor('#1976d2');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? 'Edit Category' : 'Create Category'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              label="Color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              sx={{ width: 100 }}
              required
            />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                backgroundColor: color,
                border: '1px solid #e0e0e0',
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
