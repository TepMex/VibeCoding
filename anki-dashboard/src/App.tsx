import {
  CloudSyncRounded,
  DashboardRounded,
  DownloadRounded,
  SettingsRounded,
} from '@mui/icons-material'
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  IconButton,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getSyncStatus, isNative } from './services/anki-web'
import { loadCollection, saveCollection } from './services/collection-store'
import { getCollectionWorker } from './services/collection-worker'
import type {
  CollectionMetadata,
  DashboardData,
  SyncStatus,
} from './types'

const DashboardContent = lazy(() =>
  import('./components/DashboardContent').then((module) => ({
    default: module.DashboardContent,
  })),
)
const SyncDialog = lazy(() =>
  import('./components/SyncDialog').then((module) => ({
    default: module.SyncDialog,
  })),
)

const SELECTED_DECKS_KEY = 'anki-dashboard.selected-decks'
const SOURCE_LABEL_KEY = 'anki-dashboard.source-label'
const I_PLUS_ONE_FIELDS_KEY = 'anki-dashboard.i-plus-one-fields'

const theme = createTheme({
  colorSchemes: { dark: true },
  cssVariables: true,
  palette: {
    primary: { main: '#5b5bd6' },
    secondary: { main: '#0f9d7a' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.03em' },
    h5: { letterSpacing: '-0.02em' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
})

const emptySyncStatus: SyncStatus = {
  hasCollection: false,
  connected: false,
  username: '',
  endpoint: 'https://sync.ankiweb.net/',
  syncedAt: null,
}

function readSelectedDecks() {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_DECKS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function readIPlusOneFields() {
  try {
    return JSON.parse(
      localStorage.getItem(I_PLUS_ONE_FIELDS_KEY) ?? '{}',
    ) as Record<string, string>
  } catch {
    return {}
  }
}

function App() {
  const [metadata, setMetadata] = useState<CollectionMetadata | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [selectedDecks, setSelectedDecks] = useState<string[]>(readSelectedDecks)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(emptySyncStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadingCollection, setLoadingCollection] = useState(true)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [error, setError] = useState('')
  const [sourceLabel, setSourceLabel] = useState(
    () => localStorage.getItem(SOURCE_LABEL_KEY) ?? '',
  )
  const [iPlusOneFields, setIPlusOneFields] = useState(readIPlusOneFields)

  const refreshSyncStatus = useCallback(async () => {
    setSyncStatus(await getSyncStatus())
  }, [])

  const installCollection = useCallback(
    async (buffer: ArrayBuffer, label: string, persist = true) => {
      const signature = new TextDecoder('ascii').decode(
        new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)),
      )
      if (!signature.startsWith('SQLite format 3')) {
        throw new Error('This file is not a valid Anki collection.anki2 database.')
      }

      const result = await getCollectionWorker().loadCollection(buffer.slice(0))
      if (persist) await saveCollection(buffer)
      setMetadata(result)
      setSourceLabel(label)
      localStorage.setItem(SOURCE_LABEL_KEY, label)
      setError('')

      const available = new Set(result.decks.map((deck) => deck.name))
      const reconciled = selectedDecks.filter(
        (selected) =>
          available.has(selected) ||
          [...available].some((name) => name.startsWith(`${selected}::`)),
      )
      if (reconciled.length !== selectedDecks.length) {
        setSelectedDecks(reconciled)
      }
    },
    [selectedDecks],
  )

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      try {
        await refreshSyncStatus()
        const stored = await loadCollection()
        if (!stored || cancelled) return
        await installCollection(stored, sourceLabel || 'Saved collection', false)
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      } finally {
        if (!cancelled) setLoadingCollection(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
    }
    // Only restore persisted state on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(SELECTED_DECKS_KEY, JSON.stringify(selectedDecks))
    if (!metadata || selectedDecks.length === 0) {
      setDashboard(null)
      return
    }

    let cancelled = false
    setLoadingDashboard(true)
    getCollectionWorker()
      .analyze(selectedDecks, iPlusOneFields)
      .then((result) => {
        if (!cancelled) {
          setDashboard(result)
          setError('')
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDashboard(false)
      })
    return () => {
      cancelled = true
    }
  }, [iPlusOneFields, metadata, selectedDecks])

  useEffect(() => {
    localStorage.setItem(I_PLUS_ONE_FIELDS_KEY, JSON.stringify(iPlusOneFields))
  }, [iPlusOneFields])

  const deckNames = useMemo(
    () => metadata?.decks.map((deck) => deck.name) ?? [],
    [metadata],
  )

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor:
            'color-mix(in srgb, var(--mui-palette-background-default) 90%, transparent)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <Toolbar>
          <DashboardRounded color="primary" sx={{ mr: 1.25 }} />
          <Typography
            variant="h6"
            component="h1"
            sx={{ flex: 1, fontWeight: 800 }}
          >
            Anki Dashboard
          </Typography>
          {syncStatus.connected && (
            <Chip
              icon={<CloudSyncRounded />}
              label="AnkiWeb"
              color="success"
              size="small"
              variant="outlined"
              sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}
          <Tooltip title="Collection settings">
            <IconButton
              aria-label="Collection settings"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsRounded />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ py: { xs: 2, sm: 4 } }}>
        <Stack sx={{ gap: 3 }}>
          <Box>
            <Typography variant="h4">Your learning, in focus</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Private, local-first analytics from your Anki review history.
            </Typography>
          </Box>

          {!isNative && (
            <Alert
              severity="info"
              action={
                <Button
                  component="a"
                  href="anki-dashboard.apk"
                  download
                  color="inherit"
                  size="small"
                  startIcon={<DownloadRounded />}
                >
                  APK
                </Button>
              }
            >
              Install the Android app for direct, download-only AnkiWeb sync.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {loadingCollection ? (
            <Stack sx={{ alignItems: 'center', gap: 2, py: 10 }}>
              <CircularProgress />
              <Typography color="text.secondary">Opening your collection…</Typography>
            </Stack>
          ) : !metadata ? (
            <Card variant="outlined" sx={{ maxWidth: 640 }}>
              <CardContent>
                <Typography variant="h5" sx={{ fontWeight: 750 }}>
                  Connect your collection
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Sync from AnkiWeb in the Android app, or import collection.anki2.
                  Analysis stays on this device.
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<CloudSyncRounded />}
                  onClick={() => setSettingsOpen(true)}
                >
                  Choose source
                </Button>
              </CardActions>
            </Card>
          ) : (
            <>
              <Card variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    sx={{ gap: 2, alignItems: { md: 'center' } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Decks
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metadata.cardCount.toLocaleString()} cards · {sourceLabel}
                      </Typography>
                    </Box>
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      options={deckNames}
                      value={selectedDecks}
                      onChange={(_, value) => setSelectedDecks(value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Select Anki decks" />
                      )}
                      sx={{ width: { xs: '100%', md: 560 } }}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {selectedDecks.length === 0 ? (
                <Alert severity="info">
                  Select one or more decks to calculate your statistics.
                </Alert>
              ) : loadingDashboard ? (
                <Stack sx={{ alignItems: 'center', gap: 2, py: 10 }}>
                  <CircularProgress />
                  <Typography color="text.secondary">
                    Calculating review history…
                  </Typography>
                </Stack>
              ) : dashboard ? (
                <Suspense fallback={<CircularProgress />}>
                  <DashboardContent
                    data={dashboard}
                    selectedDecks={selectedDecks}
                    iPlusOneFields={iPlusOneFields}
                    onIPlusOneFieldChange={(deck, field) =>
                      setIPlusOneFields((current) => ({
                        ...current,
                        [deck]: field,
                      }))
                    }
                  />
                </Suspense>
              ) : null}
            </>
          )}
        </Stack>
      </Container>

      <Box component="footer" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Bun · React · Vite · local SQLite analytics
        </Typography>
      </Box>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SyncDialog
            open
            status={syncStatus}
            onClose={() => setSettingsOpen(false)}
            onCollection={installCollection}
            onStatusChanged={refreshSyncStatus}
          />
        </Suspense>
      )}
    </ThemeProvider>
  )
}

export default App
