import re
from collections import defaultdict
from typing import Dict, Iterable, List


STOPWORDS_EN = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "same",
    "the",
    "to",
    "with",
}


_WORD_RE = re.compile(r"[a-z]+")
_PAREN_RE = re.compile(r"\([^)]*\)")
_BRACK_RE = re.compile(r"\[[^\]]*\]")


def _dedupe_preserve(words: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for word in words:
        if word in seen:
            continue
        seen.add(word)
        ordered.append(word)
    return ordered


def _extract_english_words(text: str) -> List[str]:
    normalized = text.lower()
    normalized = _PAREN_RE.sub(" ", normalized)
    normalized = _BRACK_RE.sub(" ", normalized)
    words = [
        match.group(0)
        for match in _WORD_RE.finditer(normalized)
        if match.group(0) not in STOPWORDS_EN and len(match.group(0)) > 1
    ]
    return _dedupe_preserve(words)


def extract_english_words(text: str) -> List[str]:
    return _extract_english_words(text)


def parse_unihan_definitions(path: str) -> Dict[str, List[str]]:
    result: Dict[str, List[str]] = defaultdict(list)
    with open(path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            if parts[2] != "kDefinition":
                continue
            hanzi = parts[1]
            definition = parts[3]
            result[hanzi] = _dedupe_preserve(
                result[hanzi] + _extract_english_words(definition)
            )
    return result
