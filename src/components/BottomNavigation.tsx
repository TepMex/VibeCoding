import { Paper, BottomNavigation, BottomNavigationAction } from "@mui/material";
import { TextFields, Assessment, Settings, Map } from "@mui/icons-material";

export type Screen = "input" | "report" | "configuration" | "map";

interface BottomNavigationPanelProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function BottomNavigationPanel({
  currentScreen,
  onScreenChange,
}: BottomNavigationPanelProps) {
  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <BottomNavigation
        value={currentScreen}
        onChange={(_, newValue) => onScreenChange(newValue)}
        showLabels
      >
        <BottomNavigationAction
          label="Input"
          value="input"
          icon={<TextFields />}
        />
        <BottomNavigationAction
          label="Report"
          value="report"
          icon={<Assessment />}
        />
        <BottomNavigationAction
          label="Config"
          value="configuration"
          icon={<Settings />}
        />
        <BottomNavigationAction
          label="Map"
          value="map"
          icon={<Map />}
        />
      </BottomNavigation>
    </Paper>
  );
}

