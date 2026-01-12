import { ListItem, ListItemText, IconButton, Box } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { LegendCategory } from '../types';

interface CategoryItemProps {
  category: LegendCategory;
  onEdit: () => void;
  onDelete: () => void;
}

export function CategoryItem({ category, onEdit, onDelete }: CategoryItemProps) {
  return (
    <ListItem
      sx={{
        borderLeft: `4px solid ${category.color}`,
        mb: 1,
        backgroundColor: 'background.paper',
        borderRadius: 1,
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: category.color,
          mr: 2,
        }}
      />
      <ListItemText
        primary={category.name}
        secondary={category.description}
      />
      <IconButton edge="end" onClick={onEdit} size="small" sx={{ mr: 1 }}>
        <EditIcon />
      </IconButton>
      <IconButton edge="end" onClick={onDelete} size="small" color="error">
        <DeleteIcon />
      </IconButton>
    </ListItem>
  );
}
