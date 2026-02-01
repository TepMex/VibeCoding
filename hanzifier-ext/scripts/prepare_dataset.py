import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from lib.morph_en import (
    encode_suffix_variants as encode_en_suffixes,
    generate_inflections as generate_en_inflections,
    lemmatize_variants as en_lemmatize_variants,
)
from lib.morph_ru import (
    encode_suffix_variants as encode_ru_suffixes,
    generate_lexeme_forms,
)
from lib.parse_bkrs import parse_bkrs_definitions
from lib.parse_unihan import extract_english_words, parse_unihan_definitions


def _load_frequency_list(path: Path) -> List[str]:
    hanzi_list: List[str] = []
    with path.open("r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            hanzi = row.get("hanzi_sc")
            if hanzi:
                hanzi_list.append(hanzi)
    return hanzi_list


def _load_frequency_english(path: Path) -> Dict[str, List[str]]:
    en_map: Dict[str, List[str]] = {}
    with path.open("r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            hanzi = row.get("hanzi_sc")
            definition = row.get("cc_cedict_definitions") or ""
            if not hanzi or not definition:
                continue
            words = extract_english_words(definition)
            if not words:
                continue
            existing = en_map.get(hanzi, [])
            en_map[hanzi] = _dedupe_preserve(existing + words)
    return en_map


def _expand_english_word(word: str) -> Set[str]:
    variants: Set[str] = set()
    for lemma in en_lemmatize_variants(word):
        forms = generate_en_inflections(lemma)
        variants.update(encode_en_suffixes(lemma, forms, drop_non_prefix=True))
    return variants


def _expand_russian_word(word: str) -> Set[str]:
    lemma, forms = generate_lexeme_forms(word)
    return encode_ru_suffixes(lemma, forms, drop_non_prefix=True)


def _dedupe_preserve(words: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for word in words:
        if word in seen:
            continue
        seen.add(word)
        ordered.append(word)
    return ordered


def _select_roots(
    en_roots: List[str],
    ru_roots: List[str],
    max_roots: int = 3,
) -> List[Tuple[str, str]]:
    combined = _dedupe_preserve(en_roots + ru_roots)
    selected = combined[:max_roots]
    tagged: List[Tuple[str, str]] = []
    for word in selected:
        lang = "ru" if any("а" <= ch.lower() <= "я" or ch.lower() == "ё" for ch in word) else "en"
        tagged.append((word, lang))
    return tagged


def _collect_meanings(
    hanzi_list: Iterable[str],
    en_map: Dict[str, List[str]],
    ru_map: Dict[str, List[str]],
) -> List[Dict[str, List[str]]]:
    dataset: List[Dict[str, List[str]]] = []
    en_cache: Dict[str, Set[str]] = {}
    ru_cache: Dict[str, Set[str]] = {}

    for hanzi in hanzi_list:
        meanings: List[str] = []
        seen_meanings: Set[str] = set()
        selected_roots = _select_roots(
            en_map.get(hanzi, []),
            ru_map.get(hanzi, []),
        )
        for word, lang in selected_roots:
            if lang == "ru":
                if word not in ru_cache:
                    ru_cache[word] = _expand_russian_word(word)
                variants = ru_cache[word]
            else:
                if word not in en_cache:
                    en_cache[word] = _expand_english_word(word)
                variants = en_cache[word]
            for variant in variants:
                if variant in seen_meanings:
                    continue
                seen_meanings.add(variant)
                meanings.append(variant)

        dataset.append(
            {
                "hanzi": hanzi,
                "meanings": meanings,
            }
        )
    return dataset


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def _write_lists(dataset: List[Dict[str, List[str]]], out_dir: Path) -> None:
    chunk_size = 100
    for idx in range(0, len(dataset), chunk_size):
        chunk = dataset[idx : idx + chunk_size]
        list_number = idx // chunk_size + 1
        filename = f"list_{list_number:03d}.json"
        _write_json(out_dir / filename, chunk)


def _summarize(dataset: List[Dict[str, List[str]]]) -> None:
    total_hanzi = len(dataset)
    total_meanings = sum(len(item["meanings"]) for item in dataset)
    with_suffix = sum(
        1 for item in dataset for meaning in item["meanings"] if "#" in meaning
    )
    print(f"Hanzi count: {total_hanzi}")
    print(f"Total meanings: {total_meanings}")
    print(f"Meanings with suffix encoding: {with_suffix}")
    print("Sample entries:")
    for item in dataset[:5]:
        sample = ", ".join(item["meanings"][:10])
        print(f"- {item['hanzi']}: {sample}")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Prepare hanzi meaning dataset.")
    parser.add_argument(
        "--data-dir",
        default=repo_root / "data",
        type=Path,
        help="Path to data directory (default: repo data/).",
    )
    parser.add_argument(
        "--output-dir",
        default=repo_root / "data" / "processed",
        type=Path,
        help="Path to output directory (default: data/processed/).",
    )
    args = parser.parse_args()

    freq_path = args.data_dir / "hanzi-frequency.csv"
    unihan_path = args.data_dir / "unihan-kdefinition.txt"
    bkrs_dir = args.data_dir / "BKRS"

    hanzi_list = _load_frequency_list(freq_path)
    en_map = parse_unihan_definitions(str(unihan_path))
    freq_en_map = _load_frequency_english(freq_path)
    for hanzi, words in freq_en_map.items():
        en_map[hanzi] = _dedupe_preserve(en_map.get(hanzi, []) + words)
    ru_map = parse_bkrs_definitions(str(bkrs_dir))

    dataset = _collect_meanings(hanzi_list, en_map, ru_map)
    _write_json(args.output_dir / "hanzi-meanings.json", dataset)
    _write_lists(dataset, args.output_dir / "lists")
    _summarize(dataset)


if __name__ == "__main__":
    main()
