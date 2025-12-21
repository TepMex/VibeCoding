import { useMemo } from "react";
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
} from "@mui/material";
import { pinyin } from "pinyin";

interface HanziMapScreenProps {
  text: string;
}

const INITIALS = ["∅", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "z", "c", "s", "zh", "ch", "sh", "r"];
const FINALS = ["i", "a", "ai", "an", "ang", "ao", "e", "ei", "en", "eng", "er", "ia", "ian", "iang", "iao", "ie", "in", "ing", "iong", "iou", "o", "ong", "ou", "u", "ua", "uai", "uan", "uang", "uei", "uen", "ueng", "uo", "ü", "üan", "üe", "ün"];

function removeTones(pinyinStr: string): string {
  return pinyinStr
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜ]/g, "ü");
}

// Map common pinyin variations to standard finals
const PINYIN_VARIATIONS: Record<string, string> = {
  "iu": "iou",
  "ui": "uei",
  "un": "uen",
};

function normalizePinyin(pinyinStr: string): string {
  let normalized = removeTones(pinyinStr.toLowerCase());
  
  // Handle variations
  for (const [variant, standard] of Object.entries(PINYIN_VARIATIONS)) {
    if (normalized.endsWith(variant)) {
      normalized = normalized.slice(0, -variant.length) + standard;
      break;
    }
  }
  
  return normalized;
}

function parsePinyinToSyllable(pinyinStr: string): { initial: string; final: string } | null {
  const normalized = normalizePinyin(pinyinStr);
  
  // Sort initials by length (longest first) to match "zh", "ch", "sh" before single letters
  const sortedInitials = [...INITIALS].sort((a, b) => b.length - a.length);
  
  for (const initial of sortedInitials) {
    if (initial === "∅") continue;
    
    if (normalized.startsWith(initial)) {
      const final = normalized.slice(initial.length);
      if (FINALS.includes(final)) {
        return { initial, final };
      }
    }
  }
  
  // Check if it's a zero-initial syllable (just a final)
  if (FINALS.includes(normalized)) {
    return { initial: "∅", final: normalized };
  }
  
  return null;
}

export function HanziMapScreen({ text }: HanziMapScreenProps) {
  const hanziMap = useMemo(() => {
    const hanziRegex = /[\u4e00-\u9fff]/g;
    const matches = text.match(hanziRegex);
    if (!matches) return new Map<string, string[]>();
    
    const map = new Map<string, string[]>();
    
    matches.forEach((hanzi) => {
      try {
        const pinyinResult = pinyin(hanzi, {
          style: pinyin.STYLE_TONE,
          heteronym: false,
        });
        
        if (pinyinResult && pinyinResult.length > 0 && pinyinResult[0].length > 0) {
          const pinyinStr = pinyinResult[0][0];
          const syllable = parsePinyinToSyllable(pinyinStr);
          
          if (syllable) {
            const key = `${syllable.initial}-${syllable.final}`;
            if (!map.has(key)) {
              map.set(key, []);
            }
            const hanziList = map.get(key)!;
            if (!hanziList.includes(hanzi)) {
              hanziList.push(hanzi);
            }
          }
        }
      } catch (error) {
        console.error(`Error converting hanzi ${hanzi} to pinyin:`, error);
      }
    });
    
    return map;
  }, [text]);

  const hanziSet = useMemo(() => {
    const hanziRegex = /[\u4e00-\u9fff]/g;
    const matches = text.match(hanziRegex);
    return new Set(matches || []);
  }, [text]);

  const getSyllable = (initial: string, final: string): string => {
    if (initial === "∅") {
      return final;
    }
    return initial + final;
  };

  const getHanziForCell = (initial: string, final: string): string[] => {
    const key = `${initial}-${final}`;
    return hanziMap.get(key) || [];
  };

  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Hanzi Map
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        {hanziSet.size > 0
          ? `Found ${hanziSet.size} unique hanzi in the text`
          : "No hanzi found in the text. Enter text in the Input screen."}
      </Typography>
      <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  backgroundColor: "background.paper",
                  borderRight: "1px solid",
                  borderColor: "divider",
                  minWidth: 60,
                }}
              >
                Initial\Final
              </TableCell>
              {FINALS.map((final) => (
                <TableCell
                  key={final}
                  align="center"
                  sx={{
                    minWidth: 50,
                    fontSize: "0.75rem",
                  }}
                >
                  {final}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {INITIALS.map((initial) => (
              <TableRow key={initial}>
                <TableCell
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    backgroundColor: "background.paper",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    fontWeight: "bold",
                  }}
                >
                  {initial}
                </TableCell>
                {FINALS.map((final) => {
                  const hanziList = getHanziForCell(initial, final);
                  const hasHanzi = hanziList.length > 0;
                  return (
                    <TableCell
                      key={`${initial}-${final}`}
                      align="center"
                      sx={{
                        backgroundColor: hasHanzi ? "action.selected" : "transparent",
                        fontSize: "0.7rem",
                        minWidth: 50,
                        padding: "4px",
                      }}
                    >
                      {hasHanzi ? (
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "2px",
                            justifyContent: "center",
                            fontSize: "0.9rem",
                          }}
                        >
                          {hanziList.map((hanzi, idx) => (
                            <Box key={idx} component="span">
                              {hanzi}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box sx={{ color: "text.disabled", fontSize: "0.6rem" }}>
                          {getSyllable(initial, final)}
                        </Box>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

