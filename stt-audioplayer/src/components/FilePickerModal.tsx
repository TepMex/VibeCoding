import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HistoryIcon from '@mui/icons-material/History';
import { type FileType, type RecentFile, getRecentFiles, isFSAAAvailable, loadRecentFile, saveRecentFile, setCurrentFile } from '../utils/fileStorage';

interface PickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
  types?: PickerAcceptType[];
}

interface WindowWithOpenFilePicker extends Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}

interface FilePickerModalProps {
  open: boolean;
  type: FileType;
  onClose: () => void;
  onFileSelect: (file: File, fileId: string) => Promise<void> | void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function getInputAccept(type: FileType): string {
  return type === 'audio'
    ? 'audio/mpeg,audio/mp3,.mp3'
    : '.txt,.html,.htm,.epub,.fb2';
}

function getPickerTypes(type: FileType): PickerAcceptType[] {
  if (type === 'audio') {
    return [
      {
        description: 'Audio files',
        accept: {
          'audio/mpeg': ['.mp3'],
        },
      },
    ];
  }

  return [
    {
      description: 'Text files',
      accept: {
        'text/plain': ['.txt'],
        'text/html': ['.html', '.htm'],
        'application/epub+zip': ['.epub'],
        'application/xml': ['.fb2'],
      },
    },
  ];
}

export function FilePickerModal({ open, type, onClose, onFileSelect }: FilePickerModalProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const supportsFSAA = useMemo(() => isFSAAAvailable(), []);

  const refreshRecentFiles = async () => {
    const files = await getRecentFiles(type);
    setRecentFiles(files);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    refreshRecentFiles().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load recent files');
    });
  }, [open, type]);

  const finalizeSelection = async (file: File, fileId: string): Promise<void> => {
    await setCurrentFile(type, fileId);
    await onFileSelect(file, fileId);
    await refreshRecentFiles();
    onClose();
  };

  const handleRecentClick = async (fileId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const file = await loadRecentFile(fileId, type);
      await finalizeSelection(file, fileId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to restore recent file');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickedFile = async (file: File, handle?: FileSystemFileHandle) => {
    setIsLoading(true);
    setError(null);
    try {
      const fileId = await saveRecentFile(type, file, handle);
      await finalizeSelection(file, fileId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save selected file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseClick = async () => {
    const windowWithPicker = window as WindowWithOpenFilePicker;
    if (supportsFSAA && windowWithPicker.showOpenFilePicker) {
      try {
        setError(null);
        const handles = await windowWithPicker.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: false,
          types: getPickerTypes(type),
        });

        const handle = handles[0];
        if (!handle) return;
        const file = await handle.getFile();
        await handlePickedFile(file, handle);
        return;
      } catch (pickerError) {
        const domError = pickerError as DOMException;
        if (domError?.name !== 'AbortError') {
          setError(domError?.message || 'Failed to open file picker');
        }
        return;
      }
    }

    inputRef.current?.click();
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handlePickedFile(file);
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>{type === 'audio' ? 'Select audio file' : 'Select text file'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          {error && <Alert severity="warning">{error}</Alert>}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="subtitle2">Recent files</Typography>
          </Box>

          {recentFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No recent files yet.
            </Typography>
          ) : (
            <List dense disablePadding>
              {recentFiles.map((item) => (
                <ListItemButton
                  key={item.id}
                  disabled={isLoading}
                  onClick={() => {
                    handleRecentClick(item.id).catch((loadError) => {
                      setError(loadError instanceof Error ? loadError.message : 'Failed to restore file');
                    });
                  }}
                >
                  <ListItemText
                    primary={item.filename}
                    secondary={`${formatDate(item.lastOpened)} • ${formatSize(item.size)}${item.hasCachedContent ? ' • cached' : ''}${item.hasHandle ? ' • handle' : ''}`}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>Close</Button>
        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => {
          handleBrowseClick().catch((browseError) => {
            setError(browseError instanceof Error ? browseError.message : 'Failed to browse files');
          });
        }} disabled={isLoading}>
          Browse
        </Button>
      </DialogActions>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={getInputAccept(type)}
        onChange={handleInputChange}
      />
    </Dialog>
  );
}
