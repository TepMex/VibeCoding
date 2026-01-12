import { useState } from 'react';
import { Container, Typography, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { CategoryList } from './CategoryList';
import { CategoryDialog } from './CategoryDialog';
import { useAppData } from '../hooks/useAppData';
import type { LegendCategory } from '../types';

export function SettingsScreen() {
  const { categories, loading, addCategory, updateCategory, deleteCategory } =
    useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LegendCategory | null>(null);

  const handleCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleEdit = (category: LegendCategory) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategory(id);
    }
  };

  const handleSave = (category: LegendCategory) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, category);
    } else {
      addCategory(category);
    }
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container 
      maxWidth="md" 
      sx={{ 
        py: { xs: 2, sm: 3 },
        px: { xs: 1, sm: 2, md: 3 },
        pb: { xs: 10, sm: 10 },
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
        Settings
      </Typography>
      <Typography 
        variant="body1" 
        color="text.secondary" 
        sx={{ 
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '0.875rem', sm: '1rem' },
        }}
      >
        Manage your legend categories
      </Typography>
      <CategoryList
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          zIndex: 1000,
        }}
        onClick={handleCreate}
        size="medium"
      >
        <AddIcon />
      </Fab>
      <CategoryDialog
        open={dialogOpen}
        category={editingCategory}
        onClose={handleCloseDialog}
        onSave={handleSave}
      />
    </Container>
  );
}
