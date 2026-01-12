import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
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
    <Dialog 
      open={open} 
      onClose={handleClose} 
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
        {category ? 'Edit Category' : 'Create Category'}
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 1, sm: 2 },
          }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            sx={{ 
              mb: { xs: 2, sm: 2.5 },
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ 
              mb: { xs: 2, sm: 2.5 },
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
          />
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 1.5, sm: 2 },
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <TextField
              label="Color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              sx={{ 
                width: { xs: 80, sm: 100 },
                '& .MuiInputBase-root': {
                  height: { xs: 40, sm: 56 },
                },
              }}
              required
            />
            <Box
              sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: 1,
                backgroundColor: color,
                border: '1px solid #e0e0e0',
                flexShrink: 0,
              }}
            />
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
            onClick={handleClose}
            sx={{
              fontSize: { xs: '0.875rem', sm: '1rem' },
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={!name.trim()}
            sx={{
              fontSize: { xs: '0.875rem', sm: '1rem' },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
