import { Box, Typography } from "@mui/material";

export function ConfigurationScreen() {
  return (
    <Box sx={{ p: 3, height: "100%" }}>
      <Typography variant="h5" gutterBottom>
        Configuration
      </Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        Hanzi lists management will be displayed here.
      </Typography>
    </Box>
  );
}

