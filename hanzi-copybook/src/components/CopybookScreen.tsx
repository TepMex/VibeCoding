import { Box, Button, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useMemo, useState } from 'react'
import CopybookPage from './CopybookPage'

type GridStyle = 'tian' | 'mi'

type CopybookScreenProps = {
  hanziList: string[]
  cellSizeMm: number
  exampleLines: number
}

function CopybookScreen({
  hanziList,
  cellSizeMm,
  exampleLines,
}: CopybookScreenProps) {
  const [gridStyle, setGridStyle] = useState<GridStyle>('tian')

  const normalizedList = useMemo(
    () => hanziList.filter((item) => item.trim().length > 0),
    [hanziList],
  )

  return (
    <Box className="copybook-screen">
      <Box className="screen-only copybook-controls">
        <Stack direction="row" spacing={2} alignItems="center">
          <ToggleButtonGroup
            exclusive
            value={gridStyle}
            onChange={(_, value) => {
              if (value) setGridStyle(value)
            }}
            size="small"
          >
            <ToggleButton value="tian">Tian zi ge</ToggleButton>
            <ToggleButton value="mi">Mi zi ge</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined">Copy link</Button>
          <Button variant="contained">Download PDF</Button>
        </Stack>
      </Box>
      <Stack spacing={4} alignItems="center">
        {normalizedList.map((hanzi) => (
          <CopybookPage
            key={`page-${hanzi}`}
            hanzi={hanzi}
            cellSizeMm={cellSizeMm}
            exampleLines={exampleLines}
            gridStyle={gridStyle}
          />
        ))}
      </Stack>
    </Box>
  )
}

export default CopybookScreen
