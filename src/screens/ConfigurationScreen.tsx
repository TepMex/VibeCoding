import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  ListItemSecondaryAction,
  Chip,
  Collapse,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { Add, Delete, Edit, ContentCopy } from "@mui/icons-material";
import { HanziList, HanziListType } from "../store/types/HanziList";
import { HanziListStore } from "../store/HanziListStore";
import { PREDEFINED_LISTS } from "../store/predefinedLists";

export function ConfigurationScreen() {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<HanziListType>(
    HanziListType.Inclusive
  );
  const [newListData, setNewListData] = useState("");
  const [newListColor, setNewListColor] = useState("#1976d2");
  const [userLists, setUserLists] = useState<HanziList[]>([]);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const store = useMemo(() => new HanziListStore(), []);

  useEffect(() => {
    try {
      const lists = store.load();
      setUserLists(lists);
    } catch (error) {
      console.error("Failed to load lists:", error);
      setUserLists([]);
    }
  }, [store]);

  const handleOpen = () => {
    setEditingIndex(null);
    setNewListName("");
    setNewListType(HanziListType.Inclusive);
    setNewListData("");
    setNewListColor("#1976d2");
    setOpen(true);
  };

  const handleEdit = (list: HanziList) => {
    const globalIndex = userLists.findIndex(
      (l) => l.name === list.name && l.type === list.type
    );
    if (globalIndex !== -1) {
      setEditingIndex(globalIndex);
      setNewListName(list.name);
      setNewListType(list.type);
      setNewListData(list.data);
      setNewListColor(list.color || "#1976d2");
      setOpen(true);
    }
  };

  const handleDelete = (list: HanziList) => {
    const updatedLists = userLists.filter(
      (l) => !(l.name === list.name && l.type === list.type)
    );
    store.save(updatedLists);
    setUserLists(updatedLists);
  };

  const handleCopy = async (list: HanziList) => {
    try {
      await navigator.clipboard.writeText(list.data);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingIndex(null);
    setNewListName("");
    setNewListType(HanziListType.Inclusive);
    setNewListData("");
    setNewListColor("#1976d2");
  };

  const handleSave = () => {
    if (!newListName.trim() || !newListData.trim()) {
      return;
    }

    const updatedList: HanziList = {
      name: newListName.trim(),
      type: newListType,
      data: newListData.trim(),
      color: newListColor,
    };

    let updatedLists: HanziList[];
    if (editingIndex !== null) {
      updatedLists = [...userLists];
      updatedLists[editingIndex] = updatedList;
    } else {
      updatedLists = [...userLists, updatedList];
    }

    store.save(updatedLists);
    setUserLists(updatedLists);
    handleClose();
  };

  const toggleListExpansion = (listKey: string) => {
    const newExpanded = new Set(expandedLists);
    if (newExpanded.has(listKey)) {
      newExpanded.delete(listKey);
    } else {
      newExpanded.add(listKey);
    }
    setExpandedLists(newExpanded);
  };

  const getListKey = (list: HanziList, index: number) => {
    return `${list.name}-${list.type}-${index}`;
  };

  const inclusiveLists = userLists.filter(
    (list) => list.type === HanziListType.Inclusive
  );
  const exclusiveLists = userLists.filter(
    (list) => list.type === HanziListType.Exclusive
  );

  return (
    <Box sx={{ p: 3, height: "100%", pb: 10, position: "relative" }}>
      <Typography variant="h5" gutterBottom>
        Configuration
      </Typography>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Pre-defined Lists
        </Typography>
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <List>
            {PREDEFINED_LISTS.map((list, index) => {
              const listKey = `predefined-${index}`;
              const isExpanded = expandedLists.has(listKey);
              return (
                <div key={index}>
                  <ListItem>
                    {list.color && (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          backgroundColor: list.color,
                          mr: 1,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                        aria-label={`Color: ${list.color}`}
                      />
                    )}
                    <ListItemText
                      primary={list.name}
                      secondary={`Type: ${list.type} | Characters: ${list.data.length}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label={isExpanded ? "collapse" : "expand"}
                        onClick={() => toggleListExpansion(listKey)}
                        sx={{ mr: 1 }}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="copy"
                        onClick={() => handleCopy(list)}
                      >
                        <ContentCopy />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, pt: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        All characters in this list:
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          maxHeight: "300px",
                          overflowY: "auto",
                        }}
                        role="list"
                        aria-label={`Characters in ${list.name}`}
                      >
                        {Array.from(list.data).map((char, charIndex) => (
                          <Chip
                            key={`${listKey}-char-${charIndex}`}
                            label={char}
                            size="small"
                            sx={{
                              backgroundColor: list.color
                                ? `${list.color}20`
                                : "action.selected",
                              border: `1px solid ${list.color || "#1976d2"}`,
                              fontSize: "1.2rem",
                              minWidth: "2.5rem",
                              height: "2.5rem",
                            }}
                            aria-label={`Character: ${char}`}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Collapse>
                  {index < PREDEFINED_LISTS.length - 1 && <Divider />}
                </div>
              );
            })}
          </List>
        </Paper>

        <Typography variant="h6" gutterBottom>
          Inclusive Lists
        </Typography>
        <Paper variant="outlined" sx={{ mb: 3 }}>
          {inclusiveLists.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
              No inclusive lists yet
            </Box>
          ) : (
            <List>
              {inclusiveLists.map((list, index) => {
              const listKey = getListKey(list, index);
              const isExpanded = expandedLists.has(listKey);
              return (
                <div key={listKey}>
                  <ListItem>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: list.color || "#1976d2",
                        mr: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                      aria-label={`Color: ${list.color || "#1976d2"}`}
                    />
                    <ListItemText
                      primary={list.name}
                      secondary={`Characters: ${list.data.length}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label={isExpanded ? "collapse" : "expand"}
                        onClick={() => toggleListExpansion(listKey)}
                        sx={{ mr: 1 }}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="copy"
                        onClick={() => handleCopy(list)}
                        sx={{ mr: 1 }}
                      >
                        <ContentCopy />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        onClick={() => handleEdit(list)}
                        sx={{ mr: 1 }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDelete(list)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, pt: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        All characters in this list:
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          maxHeight: "300px",
                          overflowY: "auto",
                        }}
                        role="list"
                        aria-label={`Characters in ${list.name}`}
                      >
                        {Array.from(list.data).map((char, charIndex) => (
                          <Chip
                            key={`${listKey}-char-${charIndex}`}
                            label={char}
                            size="small"
                            sx={{
                              backgroundColor: list.color
                                ? `${list.color}20`
                                : "action.selected",
                              border: `1px solid ${list.color || "#1976d2"}`,
                              fontSize: "1.2rem",
                              minWidth: "2.5rem",
                              height: "2.5rem",
                            }}
                            aria-label={`Character: ${char}`}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Collapse>
                  {index < inclusiveLists.length - 1 && <Divider />}
                </div>
              );
            })}
            </List>
          )}
        </Paper>

        <Typography variant="h6" gutterBottom>
          Exclusive Lists
        </Typography>
        <Paper variant="outlined" sx={{ mb: 3 }}>
          {exclusiveLists.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
              No exclusive lists yet
            </Box>
          ) : (
            <List>
              {exclusiveLists.map((list, index) => {
              const listKey = getListKey(list, index);
              const isExpanded = expandedLists.has(listKey);
              return (
                <div key={listKey}>
                  <ListItem>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: list.color || "#1976d2",
                        mr: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                      aria-label={`Color: ${list.color || "#1976d2"}`}
                    />
                    <ListItemText
                      primary={list.name}
                      secondary={`Characters: ${list.data.length}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label={isExpanded ? "collapse" : "expand"}
                        onClick={() => toggleListExpansion(listKey)}
                        sx={{ mr: 1 }}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="copy"
                        onClick={() => handleCopy(list)}
                        sx={{ mr: 1 }}
                      >
                        <ContentCopy />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        onClick={() => handleEdit(list)}
                        sx={{ mr: 1 }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDelete(list)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, pt: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        All characters in this list:
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          maxHeight: "300px",
                          overflowY: "auto",
                        }}
                        role="list"
                        aria-label={`Characters in ${list.name}`}
                      >
                        {Array.from(list.data).map((char, charIndex) => (
                          <Chip
                            key={`${listKey}-char-${charIndex}`}
                            label={char}
                            size="small"
                            sx={{
                              backgroundColor: list.color
                                ? `${list.color}20`
                                : "action.selected",
                              border: `1px solid ${list.color || "#1976d2"}`,
                              fontSize: "1.2rem",
                              minWidth: "2.5rem",
                              height: "2.5rem",
                            }}
                            aria-label={`Character: ${char}`}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Collapse>
                  {index < exclusiveLists.length - 1 && <Divider />}
                </div>
              );
            })}
            </List>
          )}
        </Paper>
      </Box>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: "fixed", bottom: 80, right: 16 }}
        onClick={handleOpen}
      >
        <Add />
      </Fab>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex !== null ? "Edit List" : "Create New List"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="List Name"
              fullWidth
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newListType}
                label="Type"
                onChange={(e) => setNewListType(e.target.value as HanziListType)}
              >
                <MenuItem value={HanziListType.Inclusive}>Inclusive</MenuItem>
                <MenuItem value={HanziListType.Exclusive}>Exclusive</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Hanzi Characters"
              fullWidth
              multiline
              rows={4}
              value={newListData}
              onChange={(e) => setNewListData(e.target.value)}
              placeholder="Enter hanzi characters..."
              required
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body2">Color:</Typography>
              <TextField
                type="color"
                value={newListColor}
                onChange={(e) => setNewListColor(e.target.value)}
                sx={{
                  width: 80,
                  "& input": {
                    height: 40,
                    cursor: "pointer",
                  },
                }}
                inputProps={{
                  "aria-label": "List color",
                }}
              />
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  backgroundColor: newListColor,
                  border: "1px solid",
                  borderColor: "divider",
                }}
                aria-label={`Selected color: ${newListColor}`}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!newListName.trim() || !newListData.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
