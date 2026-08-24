import {
  CloudDownloadRounded,
  FileOpenRounded,
  LogoutRounded,
} from '@mui/icons-material'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import {
  DEFAULT_ENDPOINT,
  isNative,
  logoutAnkiWeb,
  syncFromAnkiWeb,
} from '../services/anki-web'
import type { SyncProgress, SyncStatus } from '../types'

interface Props {
  open: boolean
  status: SyncStatus
  onClose: () => void
  onCollection: (buffer: ArrayBuffer, label: string) => Promise<void>
  onStatusChanged: () => Promise<void>
}

function progressLabel(progress: SyncProgress | null) {
  if (!progress) return ''
  if (progress.phase === 'login') return 'Signing in…'
  if (progress.phase === 'meta') return 'Checking collection…'
  if (progress.phase === 'saving') return 'Saving securely on this device…'
  const megabytes = ((progress.received ?? 0) / 1_048_576).toFixed(1)
  return `Downloading collection… ${megabytes} MB`
}

export function SyncDialog({
  open,
  status,
  onClose,
  onCollection,
  onStatusChanged,
}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setUsername(status.username)
    setEndpoint(status.endpoint || DEFAULT_ENDPOINT)
    setPassword('')
    setError('')
    setProgress(null)
  }, [open, status])

  const sync = async () => {
    setBusy(true)
    setError('')
    try {
      const { buffer, result } = await syncFromAnkiWeb(
        { username: username.trim(), password: password || undefined, endpoint },
        setProgress,
      )
      await onCollection(buffer, `AnkiWeb · ${new Date(result.syncedAt).toLocaleString()}`)
      await onStatusChanged()
      setPassword('')
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await logoutAnkiWeb()
      await onStatusChanged()
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onCollection(await file.arrayBuffer(), file.name)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const canSync =
    isNative &&
    username.trim().length > 0 &&
    (password.length > 0 || status.connected)

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Collection source</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Sync is download-only. The app never uploads changes to AnkiWeb and
            never stores your password.
          </Alert>

          {!isNative && (
            <Alert severity="warning">
              Browsers cannot call AnkiWeb directly because of its CORS policy.
              Import collection.anki2 here, or install the Android app for sync.
            </Alert>
          )}

          <TextField
            label="AnkiWeb username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            disabled={!isNative || busy}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder={status.connected ? 'Leave blank to reuse the saved session' : ''}
            disabled={!isNative || busy}
          />
          <TextField
            label="Sync endpoint"
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            disabled={!isNative || busy}
          />

          {status.syncedAt && (
            <Typography variant="body2" color="text.secondary">
              Last AnkiWeb sync: {new Date(status.syncedAt).toLocaleString()}
            </Typography>
          )}
          {progress && (
            <Stack gap={0.75}>
              <Typography variant="body2">{progressLabel(progress)}</Typography>
              <LinearProgress
                variant={progress.total ? 'determinate' : 'indeterminate'}
                value={
                  progress.total
                    ? Math.min(
                        100,
                        ((progress.received ?? 0) / progress.total) * 100,
                      )
                    : undefined
                }
              />
            </Stack>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Button
            component="label"
            variant="outlined"
            startIcon={<FileOpenRounded />}
            disabled={busy}
          >
            Import collection.anki2
            <input
              hidden
              type="file"
              accept=".anki2,.sqlite,.db,application/octet-stream"
              onChange={(event) => void importFile(event.target.files?.[0])}
            />
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {status.connected && isNative && (
          <Button
            color="inherit"
            onClick={() => void logout()}
            startIcon={<LogoutRounded />}
            disabled={busy}
          >
            Forget session
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void sync()}
          startIcon={<CloudDownloadRounded />}
          disabled={!canSync || busy}
        >
          Sync now
        </Button>
      </DialogActions>
    </Dialog>
  )
}
