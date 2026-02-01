import json
import re
from collections import defaultdict
from glob import glob
from typing import Dict, Iterable, List


STOPWORDS_RU = {
    "и",
    "в",
    "во",
    "на",
    "с",
    "со",
    "к",
    "ко",
    "по",
    "от",
    "до",
    "за",
    "для",
    "о",
    "об",
    "у",
    "из",
    "под",
    "над",
    "при",
    "это",
    "этот",
    "эта",
    "эти",
    "как",
    "или",
    "что",
    "не",
    "но",
}


_RU_WORD_RE = re.compile(r"[а-яё]+", re.IGNORECASE)


def _dedupe_preserve(words: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for word in words:
        if word in seen:
            continue
        seen.add(word)
        ordered.append(word)
    return ordered


def _extract_russian_words(text: str) -> List[str]:
    words = [
        match.group(0).lower()
        for match in _RU_WORD_RE.finditer(text)
        if match.group(0).lower() not in STOPWORDS_RU
        and len(match.group(0)) > 1
    ]
    return _dedupe_preserve(words)


def _iter_term_bank_files(bkrs_dir: str) -> Iterable[str]:
    pattern = f"{bkrs_dir.rstrip('/')}/term_bank_*.json"
    return sorted(glob(pattern))


def parse_bkrs_definitions(bkrs_dir: str) -> Dict[str, List[str]]:
    result: Dict[str, List[str]] = defaultdict(list)
    for path in _iter_term_bank_files(bkrs_dir):
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
        for entry in data:
            if not entry or len(entry) < 6:
                continue
            hanzi = entry[0]
            definitions = entry[5] if isinstance(entry[5], list) else []
            for definition in definitions:
                result[hanzi] = _dedupe_preserve(
                    result[hanzi] + _extract_russian_words(definition)
                )
    return result
