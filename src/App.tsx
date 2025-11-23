import { useState } from "react";
import { Box, CssBaseline } from "@mui/material";
import { TextInputScreen } from "./screens/TextInputScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ConfigurationScreen } from "./screens/ConfigurationScreen";
import {
  BottomNavigationPanel,
  Screen,
} from "./components/BottomNavigation";
import "./index.css";

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("input");

  const renderScreen = () => {
    switch (currentScreen) {
      case "input":
        return <TextInputScreen />;
      case "report":
        return <ReportScreen />;
      case "configuration":
        return <ConfigurationScreen />;
      default:
        return <TextInputScreen />;
    }
  };

  return (
    <>
      <CssBaseline />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          pb: 7,
        }}
      >
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>{renderScreen()}</Box>
        <BottomNavigationPanel
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      </Box>
    </>
  );
}

export default App;
