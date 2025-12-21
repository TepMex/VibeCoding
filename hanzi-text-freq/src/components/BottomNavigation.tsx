import { Paper, BottomNavigation as MuiBottomNavigation, BottomNavigationAction } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';

interface BottomNavigationProps {
  currentScreen: number;
  onScreenChange: (screen: number) => void;
}

export const BottomNavigation = ({ currentScreen, onScreenChange }: BottomNavigationProps) => {
  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <MuiBottomNavigation
        showLabels
        value={currentScreen}
        onChange={(_, newValue) => onScreenChange(newValue)}
      >
        <BottomNavigationAction label="Input Text" icon={<EditIcon />} />
        <BottomNavigationAction label="Heatmap" icon={<MapIcon />} />
      </MuiBottomNavigation>
    </Paper>
  );
};


