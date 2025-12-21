import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Stack,
} from "@mui/material";
import { HanziListStore } from "../store/HanziListStore";
import { PREDEFINED_LISTS } from "../store/predefinedLists";
import { HanziList } from "../store/types/HanziList";

interface ReportScreenProps {
  text: string;
}

interface ListStats {
  list: HanziList;
  count: number;
  percentage: number;
}

export function ReportScreen({ text }: ReportScreenProps) {
  const [store] = useState(() => new HanziListStore());
  const [userLists, setUserLists] = useState<HanziList[]>([]);
  const [enabledLists, setEnabledLists] = useState<Set<string>>(new Set());

  useEffect(() => {
    const lists = store.load();
    setUserLists(lists);
    // Enable all lists by default
    const allListNames = [
      ...PREDEFINED_LISTS.map((l) => l.name),
      ...lists.map((l) => l.name),
    ];
    setEnabledLists(new Set(allListNames));
  }, []);

  const allLists = useMemo(() => {
    return [...PREDEFINED_LISTS, ...userLists];
  }, [userLists]);

  const handleToggleList = (listName: string) => {
    setEnabledLists((prev) => {
      const next = new Set(prev);
      if (next.has(listName)) {
        next.delete(listName);
      } else {
        next.add(listName);
      }
      return next;
    });
  };

  const stats = useMemo(() => {
    if (!text) return [];

    const textHanzi = Array.from(text).filter((char) =>
      /[\u4e00-\u9fff]/.test(char)
    );
    const totalHanzi = textHanzi.length;
    if (totalHanzi === 0) return [];

    const enabledListsData = allLists.filter((list) =>
      enabledLists.has(list.name)
    );

    const listStats: ListStats[] = enabledListsData.map((list) => {
      const listHanziSet = new Set(Array.from(list.data));
      const count = textHanzi.filter((char) => listHanziSet.has(char)).length;
      const percentage = totalHanzi > 0 ? (count / totalHanzi) * 100 : 0;
      return { list, count, percentage };
    });

    // Calculate "not in any list" hanzi
    const allListHanziSet = new Set<string>();
    enabledListsData.forEach((list) => {
      Array.from(list.data).forEach((char) => allListHanziSet.add(char));
    });

    const notInAnyList = textHanzi.filter(
      (char) => !allListHanziSet.has(char)
    );
    const notInAnyListCount = notInAnyList.length;
    const notInAnyListPercentage =
      totalHanzi > 0 ? (notInAnyListCount / totalHanzi) * 100 : 0;

    return { listStats, notInAnyListCount, notInAnyListPercentage, totalHanzi };
  }, [text, allLists, enabledLists]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" gutterBottom>
        Report
      </Typography>

      <Box sx={{ mt: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Lists
        </Typography>
        <Stack spacing={1}>
          {allLists.map((list) => (
            <FormControlLabel
              key={list.name}
              control={
                <Switch
                  checked={enabledLists.has(list.name)}
                  onChange={() => handleToggleList(list.name)}
                />
              }
              label={`${list.name} (${list.type})`}
            />
          ))}
        </Stack>
      </Box>

      {text && stats && "listStats" in stats && (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <Typography variant="h6" gutterBottom>
            Statistics
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>List</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.listStats.map((stat) => (
                  <TableRow key={stat.list.name}>
                    <TableCell>{stat.list.name}</TableCell>
                    <TableCell align="right">{stat.count}</TableCell>
                    <TableCell align="right">
                      {stat.percentage.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>
                    <strong>Not in any list</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{stats.notInAnyListCount}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{stats.notInAnyListPercentage.toFixed(2)}%</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Total</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{stats.totalHanzi}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>100.00%</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {!text && (
        <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
          Enter text in the Text Input screen to see the report.
        </Typography>
      )}
    </Box>
  );
}
