import { useState } from "react";
import { Box, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { TextInputScreen } from "./screens/TextInputScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ConfigurationScreen } from "./screens/ConfigurationScreen";
import { HanziMapScreen } from "./screens/HanziMapScreen";
import {
  BottomNavigationPanel,
  Screen,
} from "./components/BottomNavigation";
import "./index.css";

const theme = createTheme();

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("input");
  const [text, setText] = useState("");

  const renderScreen = () => {
    switch (currentScreen) {
      case "input":
        return <TextInputScreen text={text} onTextChange={setText} />;
      case "report":
        return <ReportScreen text={text} />;
      case "configuration":
        return <ConfigurationScreen />;
      case "map":
        return <HanziMapScreen text={text} />;
      default:
        return <TextInputScreen text={text} onTextChange={setText} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
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
    </ThemeProvider>
  );
}

export default App;
