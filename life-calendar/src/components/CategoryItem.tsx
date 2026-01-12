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
        mb: { xs: 1, sm: 1.5 },
        backgroundColor: 'background.paper',
        borderRadius: 1,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1, sm: 1.5 },
      }}
    >
      <Box
        sx={{
          width: { xs: 20, sm: 24 },
          height: { xs: 20, sm: 24 },
          borderRadius: '50%',
          backgroundColor: category.color,
          mr: { xs: 1.5, sm: 2 },
          flexShrink: 0,
        }}
      />
      <ListItemText
        primary={category.name}
        secondary={category.description}
        primaryTypographyProps={{
          fontSize: { xs: '0.875rem', sm: '1rem' },
          fontWeight: 500,
        }}
        secondaryTypographyProps={{
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
        }}
        sx={{
          mr: { xs: 1, sm: 2 },
        }}
      />
      <IconButton 
        edge="end" 
        onClick={onEdit} 
        size="small" 
        sx={{ 
          mr: { xs: 0.5, sm: 1 },
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '1.125rem', sm: '1.25rem' },
          },
        }}
      >
        <EditIcon />
      </IconButton>
      <IconButton 
        edge="end" 
        onClick={onDelete} 
        size="small" 
        color="error"
        sx={{
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '1.125rem', sm: '1.25rem' },
          },
        }}
      >
        <DeleteIcon />
      </IconButton>
    </ListItem>
  );
}
