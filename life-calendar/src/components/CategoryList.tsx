import { List } from '@mui/material';
import type { LegendCategory } from '../types';
import { CategoryItem } from './CategoryItem';

interface CategoryListProps {
  categories: LegendCategory[];
  onEdit: (category: LegendCategory) => void;
  onDelete: (id: string) => void;
}

export function CategoryList({ categories, onEdit, onDelete }: CategoryListProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <List>
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          onEdit={() => onEdit(category)}
          onDelete={() => onDelete(category.id)}
        />
      ))}
    </List>
  );
}
