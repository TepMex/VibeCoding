import { Box, Typography } from "@mui/material";

export function ReportScreen() {
  return (
    <Box sx={{ p: 3, height: "100%" }}>
      <Typography variant="h5" gutterBottom>
        Report
      </Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        Complexity analysis will be displayed here.
      </Typography>
    </Box>
  );
}

