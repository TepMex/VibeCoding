import { useMemo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { pinyin } from "pinyin";
import { HanziListStore } from "../store/HanziListStore";
import { PREDEFINED_LISTS } from "../store/predefinedLists";
import { HanziList } from "../store/types/HanziList";

interface ReaderScreenProps {
  text: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function mixColors(colors: string[]): string {
  if (colors.length === 0) return "#000000";
  if (colors.length === 1) return colors[0];

  const rgbs = colors.map(hexToRgb).filter((rgb) => rgb !== null) as {
    r: number;
    g: number;
    b: number;
  }[];

  if (rgbs.length === 0) return "#000000";

  const avgR = Math.round(
    rgbs.reduce((sum, rgb) => sum + rgb.r, 0) / rgbs.length
  );
  const avgG = Math.round(
    rgbs.reduce((sum, rgb) => sum + rgb.g, 0) / rgbs.length
  );
  const avgB = Math.round(
    rgbs.reduce((sum, rgb) => sum + rgb.b, 0) / rgbs.length
  );

  return rgbToHex(avgR, avgG, avgB);
}

export function ReaderScreen({ text }: ReaderScreenProps) {
  const store = useMemo(() => new HanziListStore(), []);
  const [userLists, setUserLists] = useState<HanziList[]>([]);

  useEffect(() => {
    try {
      const lists = store.load();
      setUserLists(lists);
    } catch (error) {
      console.error("Failed to load lists:", error);
      setUserLists([]);
    }
  }, [store]);

  const allLists = useMemo(() => {
    return [...PREDEFINED_LISTS, ...userLists];
  }, [userLists]);

  const hanziToLists = useMemo(() => {
    const map = new Map<string, string[]>();
    allLists.forEach((list) => {
      if (list.color) {
        Array.from(list.data).forEach((hanzi) => {
          if (!map.has(hanzi)) {
            map.set(hanzi, []);
          }
          map.get(hanzi)!.push(list.color!);
        });
      }
    });
    return map;
  }, [allLists]);

  const getPinyin = (hanzi: string): string => {
    try {
      const pinyinResult = pinyin(hanzi, {
        style: pinyin.STYLE_TONE,
        heteronym: false,
      });
      if (pinyinResult && pinyinResult.length > 0 && pinyinResult[0].length > 0) {
        return pinyinResult[0][0];
      }
    } catch (error) {
      console.error(`Error converting hanzi ${hanzi} to pinyin:`, error);
    }
    return "";
  };

  const getColor = (hanzi: string): string | null => {
    const colors = hanziToLists.get(hanzi);
    if (!colors || colors.length === 0) return null;
    return mixColors(colors);
  };

  return (
    <Box
      sx={{
        p: 3,
        height: "100%",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography variant="h5" gutterBottom>
        Reader
      </Typography>
      <Box
        sx={{
          mt: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          lineHeight: 1.2,
          fontSize: "36pt",
          fontFamily: "serif",
        }}
      >
        {Array.from(text).map((char, index) => {
          const isHanzi = /[\u4e00-\u9fff]/.test(char);
          const color = isHanzi ? getColor(char) : null;
          const pinyinText = isHanzi ? getPinyin(char) : "";

          if (isHanzi) {
            return (
              <Box
                key={index}
                sx={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  verticalAlign: "top",
                  position: "relative",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.35em",
                    lineHeight: 1,
                    mb: "0.1em",
                    color: "text.secondary",
                    fontFamily: "sans-serif",
                  }}
                >
                  {pinyinText}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    color: color || "inherit",
                    fontSize: "1em",
                    lineHeight: 1,
                  }}
                >
                  {char}
                </Box>
              </Box>
            );
          } else {
            return (
              <Box
                key={index}
                component="span"
                sx={{
                  whiteSpace: char === "\n" ? "pre" : "normal",
                  display: char === "\n" ? "block" : "inline",
                  width: char === "\n" ? "100%" : "auto",
                }}
              >
                {char === " " ? "\u00A0" : char}
              </Box>
            );
          }
        })}
      </Box>
    </Box>
  );
}

