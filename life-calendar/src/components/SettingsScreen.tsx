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
    <Container maxWidth="md" sx={{ py: 3, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
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
          bottom: 16,
          right: 16,
        }}
        onClick={handleCreate}
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
