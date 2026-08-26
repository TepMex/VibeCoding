#!/usr/bin/env python3
"""Pack HSK 4 listening questions, audio and transcripts into Android assets."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable

SOURCE_COMMIT = "5fe9a65173a4b9aa8aae7c513ea279b10bc64023"
SOURCE_REPOSITORY = "https://github.com/Make-dream-clear/hsk4-mock-exam"
SOURCE_RAW_ROOT = (
    f"https://raw.githubusercontent.com/Make-dream-clear/"
    f"hsk4-mock-exam/{SOURCE_COMMIT}/data"
)
SOURCE_LICENSE = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
ALLOWED_AUDIO_HOST = "media.mandarinzone.com"
QUESTION_TYPES = {"listening_true_false", "listening_choice"}
AUDIO_BITRATE = "40k"
AUDIO_SAMPLE_RATE = 32000
AUDIO_CACHE_VERSION = "mp3-mono-32khz-40k"
USER_AGENT = "VibeCoding-HSK4-Listening-v2/1.0"

TRANSCRIPT_PAGE_URLS = (
    "https://www.mandarinzone.com/free-online-hsk4-mock-test-1/",
    "https://www.mandarinzone.com/hsk-4-mock-exam-series-2-h41001/",
    "https://www.mandarinzone.com/hsk4-online-mock-test-series-3/",
    "https://www.mandarinzone.com/free-online-hsk4-mock-test-series4/",
    "https://www.mandarinzone.com/hsk-4-online-mock-exam-series-5-based-hsk41005/",
    "https://www.mandarinzone.com/hsk-4-online-mock-exam-series-6-based-hsk41006/",
    "https://www.mandarinzone.com/hsk-4-online-mock-test-series-7-based-41007/",
    "https://www.mandarinzone.com/hsk-4-online-mock-test-series-8-hsk41008/",
    "https://www.mandarinzone.com/hsk4-online-mock-test-series9-h41009/",
    "https://www.mandarinzone.com/hsk-4-online-mock-practice-test-series-10/",
    "https://www.mandarinzone.com/free-hsk-4-online-mock-test-series-11-h41111/",
    "https://www.mandarinzone.com/free-hsk-4-online-mock-test-series-12/",
)

CITE_RE = re.compile(r"\[cite[^\]]*\]", re.IGNORECASE)
TEST_NUMBER_IN_URL_RE = re.compile(
    r"(?:series-?|mock-test-series-?|mock-test-|mock-exam-series-?)(\d+)",
    re.IGNORECASE,
)
QUESTION_SPLIT_RE = re.compile(
    r"(?:^|\n)\s*(?:Question\s+)?(\d{1,2})\s*[.:：]\s*",
    re.IGNORECASE,
)
PASSAGE_RANGE_RE = re.compile(
    r"第\s*(\d{1,2})\s*到\s*(\d{1,2})\s*题是根据下面一段话[:：]?\s*",
)
ENGLISH_RANGE_RE = re.compile(
    r"(?:^|\n)\s*Questions?\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*[:：]?\s*",
    re.IGNORECASE,
)
HAS_CJK_RE = re.compile(r"[\u3400-\u9fff]")


@dataclass(frozen=True)
class ListeningCard:
    test_number: int
    test_title: str
    source: str
    question_number: int
    question_type: str
    audio_url: str
    prompt: str
    options: tuple[str, ...]
    correct_index: int
    transcript: str

    @property
    def note_id(self) -> str:
        return f"hsk4-t{self.test_number:02d}-q{self.question_number:03d}"

    @property
    def media_name(self) -> str:
        return f"{self.note_id}.mp3"

    @property
    def source_url(self) -> str:
        return (
            f"{SOURCE_REPOSITORY}/blob/{SOURCE_COMMIT}/data/"
            f"test-{self.test_number:02d}.json"
        )


class _HTMLToText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.chunks: list[str] = []
        self._skip_depth = 0
        self._skip_tags = {"script", "style", "em"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._skip_tags:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag in {"br", "p", "div", "li", "h1", "h2", "h3", "h4", "tr", "blockquote"}:
            self.chunks.append("\n")
        elif tag == "summary":
            self.chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._skip_tags and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "tr", "blockquote"}:
            self.chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        self.chunks.append(data)

    def text(self) -> str:
        return "".join(self.chunks)


def html_to_text(markup: str) -> str:
    parser = _HTMLToText()
    parser.feed(markup)
    parser.close()
    return parser.text()


def clean_transcript(value: str) -> str:
    text = CITE_RE.sub("", value)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        lowered = line.lower()
        if lowered.startswith("statement:"):
            continue
        if lowered.startswith(("part 1", "part 2", "part 3", "第一部分", "第二部分", "第三部分")):
            continue
        if HAS_CJK_RE.search(line):
            lines.append(line)

    return "\n".join(lines).strip()


def extract_numbered_transcripts(markup: str) -> dict[int, str]:
    text = html_to_text(markup)
    lowered = text.lower()
    start_markers = (
        "听力材料原文",
        "full listening transcript",
        "complete listening script",
        "listening scripts",
    )
    start = -1
    for marker in start_markers:
        start = lowered.find(marker)
        if start >= 0:
            break
    if start >= 0:
        text = text[start:]
        lowered = text.lower()
    end_markers = (
        "detailed question analysis",
        "complete answer key",
        "reading comprehension",
        "ii. reading",
        "二、阅读",
        "阅读部分",
        "ready to pass",
        "join 5,000",
    )
    end = len(text)
    for marker in end_markers:
        found = lowered.find(marker)
        if 0 < found < end:
            end = found
    text = text[:end]
    matches = list(QUESTION_SPLIT_RE.finditer(text))
    extracted: dict[int, str] = {}
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if not 1 <= number <= 45:
            continue
        stop = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = clean_transcript(text[match.end() : stop])
        if body:
            extracted[number] = body

    range_matches = list(PASSAGE_RANGE_RE.finditer(text)) + list(ENGLISH_RANGE_RE.finditer(text))
    range_matches.sort(key=lambda match: match.start())
    for index, match in enumerate(range_matches):
        start_number = int(match.group(1))
        end_number = int(match.group(2))
        if start_number > end_number:
            start_number, end_number = end_number, start_number
        stop = (
            range_matches[index + 1].start()
            if index + 1 < len(range_matches)
            else len(text)
        )
        body = clean_transcript(text[match.end() : stop])
        if not body:
            continue
        for number in range(start_number, end_number + 1):
            extracted.setdefault(number, body)
    return extracted


def infer_test_number_from_url(url: str) -> int | None:
    match = TEST_NUMBER_IN_URL_RE.search(url)
    if match is None:
        return None
    number = int(match.group(1))
    if 1 <= number <= 19:
        return number
    return None


def fetch_bytes(url: str, destination: Path, timeout: int = 45) -> bytes:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read()
            destination.write_bytes(payload)
            return payload
        except (OSError, urllib.error.URLError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2**attempt)
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


def fetch_json(url: str, destination: Path) -> dict[str, Any]:
    payload = fetch_bytes(url, destination)
    return json.loads(payload)


def load_source_tests(source_dir: Path | None, cache_dir: Path) -> list[dict[str, Any]]:
    tests: list[dict[str, Any]] = []
    for test_number in range(1, 20):
        filename = f"test-{test_number:02d}.json"
        if source_dir is not None:
            path = source_dir / filename
            if not path.is_file():
                raise FileNotFoundError(f"Missing source file: {path}")
            test = json.loads(path.read_text(encoding="utf-8"))
            test["_collection_test_number"] = test_number
            tests.append(test)
            continue
        cache_path = cache_dir / "source" / SOURCE_COMMIT / filename
        if cache_path.is_file():
            test = json.loads(cache_path.read_text(encoding="utf-8"))
        else:
            test = fetch_json(f"{SOURCE_RAW_ROOT}/{filename}", cache_path)
        test["_collection_test_number"] = test_number
        tests.append(test)
    return tests


def normalize_option(value: Any, question_type: str) -> str:
    option = str(value).strip()
    if question_type == "listening_choice":
        option = re.sub(r"^[A-DＡ-Ｄ][.．、:\s]+", "", option, count=1)
    return option


def collect_cards(tests: Iterable[dict[str, Any]]) -> tuple[list[ListeningCard], dict[str, Any]]:
    cards: list[ListeningCard] = []
    skipped = Counter()
    source_listening_total = 0
    seen_ids: set[str] = set()

    for test in tests:
        test_number = int(test["_collection_test_number"])
        test_title = str(test["title"])
        source = str(test.get("source", "Mandarin Zone"))
        for question in test["questions"]:
            question_type = question.get("type")
            if question_type not in QUESTION_TYPES:
                continue
            source_listening_total += 1
            audio_url = question.get("audio")
            if not audio_url:
                skipped["no_per_question_audio"] += 1
                continue
            parsed_audio_url = urllib.parse.urlsplit(str(audio_url))
            if (
                parsed_audio_url.scheme != "https"
                or parsed_audio_url.hostname != ALLOWED_AUDIO_HOST
            ):
                raise ValueError(f"Unexpected audio URL: {audio_url}")

            options = tuple(
                normalize_option(option, question_type)
                for option in question.get("options", [])
            )
            expected_option_count = 2 if question_type == "listening_true_false" else 4
            if len(options) != expected_option_count:
                raise ValueError(
                    f"Test {test_number} question {question['number']}: "
                    f"expected {expected_option_count} options, got {len(options)}"
                )
            correct_index = int(question["correct_answer_index"])
            if not 0 <= correct_index < len(options):
                raise ValueError(
                    f"Test {test_number} question {question['number']}: "
                    f"invalid answer index {correct_index}"
                )

            card = ListeningCard(
                test_number=test_number,
                test_title=test_title,
                source=source,
                question_number=int(question["number"]),
                question_type=str(question_type),
                audio_url=str(audio_url),
                prompt=str(question.get("text", "")).strip(),
                options=options,
                correct_index=correct_index,
                transcript=str(question.get("transcript", "")).strip(),
            )
            if card.note_id in seen_ids:
                raise ValueError(f"Duplicate card ID: {card.note_id}")
            seen_ids.add(card.note_id)
            cards.append(card)

    cards.sort(key=lambda card: (card.test_number, card.question_number))
    by_type = Counter(card.question_type for card in cards)
    by_test = Counter(card.test_number for card in cards)
    report = {
        "source_repository": SOURCE_REPOSITORY,
        "source_commit": SOURCE_COMMIT,
        "source_license": "CC BY-NC-SA 4.0",
        "audio_encoding": {
            "codec": "MP3",
            "channels": 1,
            "sample_rate_hz": AUDIO_SAMPLE_RATE,
            "bitrate": AUDIO_BITRATE,
        },
        "source_listening_questions": source_listening_total,
        "included_cards": len(cards),
        "included_by_note_type": {
            "true_false": by_type["listening_true_false"],
            "choice": by_type["listening_choice"],
        },
        "included_by_test": {
            f"{test_number:02d}": count for test_number, count in sorted(by_test.items())
        },
        "skipped": dict(skipped),
    }
    return cards, report


def load_transcript_pages(
    cache_dir: Path,
    page_urls: tuple[str, ...] = TRANSCRIPT_PAGE_URLS,
) -> list[tuple[str, dict[int, str], str]]:
    pages: list[tuple[str, dict[int, str], str]] = []
    for url in page_urls:
        slug = urllib.parse.urlsplit(url).path.strip("/").replace("/", "_") or "page"
        cache_path = cache_dir / "transcripts" / f"{slug}.html"
        if cache_path.is_file():
            markup = cache_path.read_text(encoding="utf-8")
        else:
            markup = fetch_bytes(url, cache_path, timeout=60).decode("utf-8", "replace")
        pages.append((url, extract_numbered_transcripts(markup), html_to_text(markup)))
    return pages


def attach_transcripts(
    cards: list[ListeningCard],
    pages: list[tuple[str, dict[int, str], str]],
) -> tuple[list[ListeningCard], dict[str, Any]]:
    by_test: dict[int, list[ListeningCard]] = {}
    for card in cards:
        by_test.setdefault(card.test_number, []).append(card)

    assignments: dict[int, str] = {}
    for test_number, test_cards in by_test.items():
        best_url = ""
        best_score = -1
        prompts = [card.prompt for card in test_cards if card.prompt]
        for url, numbered, page_text in pages:
            inferred = infer_test_number_from_url(url)
            score = 0
            if inferred == test_number:
                score += 20
            score += sum(1 for prompt in prompts if prompt and prompt in page_text)
            score += min(len(numbered), 5)
            if score > best_score:
                best_score = score
                best_url = url
        if best_url:
            assignments[test_number] = best_url

    page_by_url = {url: numbered for url, numbered, _page_text in pages}
    filled = 0
    from_json = 0
    from_pages = 0
    updated: list[ListeningCard] = []
    for card in cards:
        transcript = card.transcript
        if transcript:
            from_json += 1
        else:
            numbered = page_by_url.get(assignments.get(card.test_number, ""), {})
            transcript = numbered.get(card.question_number, "")
            if transcript:
                from_pages += 1
        if transcript:
            filled += 1
        updated.append(
            ListeningCard(
                test_number=card.test_number,
                test_title=card.test_title,
                source=card.source,
                question_number=card.question_number,
                question_type=card.question_type,
                audio_url=card.audio_url,
                prompt=card.prompt,
                options=card.options,
                correct_index=card.correct_index,
                transcript=transcript,
            )
        )

    stats = {
        "with_transcript": filled,
        "from_json": from_json,
        "from_pages": from_pages,
        "missing": len(cards) - filled,
        "page_assignments": {
            f"{test_number:02d}": url for test_number, url in sorted(assignments.items())
        },
    }
    return updated, stats


def encode_url(url: str) -> str:
    parsed_url = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            urllib.parse.quote(urllib.parse.unquote(parsed_url.path), safe="/:@"),
            parsed_url.query,
            parsed_url.fragment,
        )
    )


def download_file(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        encode_url(url), headers={"User-Agent": USER_AGENT}
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                with destination.open("wb") as output:
                    shutil.copyfileobj(response, output)
            if destination.stat().st_size < 1024:
                raise RuntimeError(f"Downloaded audio is unexpectedly small: {url}")
            return
        except (OSError, urllib.error.URLError) as error:
            last_error = error
            destination.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(2**attempt)
    raise RuntimeError(f"Unable to download {url}: {last_error}")


def prepare_audio(card: ListeningCard, media_dir: Path) -> Path:
    output = media_dir / card.media_name
    if output.is_file() and output.stat().st_size >= 1024:
        return output

    media_dir.mkdir(parents=True, exist_ok=True)
    source_suffix = Path(urllib.parse.urlsplit(card.audio_url).path).suffix or ".audio"
    with tempfile.TemporaryDirectory(dir=media_dir) as temporary_directory:
        temporary = Path(temporary_directory)
        source = temporary / f"source{source_suffix}"
        encoded = temporary / card.media_name
        download_file(card.audio_url, source)
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-map_metadata",
                "-1",
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(AUDIO_SAMPLE_RATE),
                "-codec:a",
                "libmp3lame",
                "-b:a",
                AUDIO_BITRATE,
                str(encoded),
            ],
            check=True,
        )
        if encoded.stat().st_size < 1024:
            raise RuntimeError(f"Encoded audio is unexpectedly small: {card.note_id}")
        os.replace(encoded, output)
    return output


def prepare_all_audio(
    cards: list[ListeningCard], media_dir: Path, workers: int
) -> dict[str, Path]:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to pack audio assets")
    media_by_id: dict[str, Path] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(prepare_audio, card, media_dir): card for card in cards
        }
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            card = futures[future]
            media_by_id[card.note_id] = future.result()
            completed += 1
            if completed == 1 or completed % 25 == 0 or completed == len(cards):
                print(f"Prepared audio: {completed}/{len(cards)}", flush=True)
    return media_by_id


def catalog_payload(cards: list[ListeningCard], report: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_repository": SOURCE_REPOSITORY,
        "source_commit": SOURCE_COMMIT,
        "source_license": "CC BY-NC-SA 4.0",
        "source_license_url": SOURCE_LICENSE,
        "included_cards": len(cards),
        "transcripts": report.get("transcripts", {}),
        "questions": [
            {
                "id": card.note_id,
                "test_number": card.test_number,
                "test_title": card.test_title,
                "question_number": card.question_number,
                "type": card.question_type,
                "prompt": card.prompt,
                "options": list(card.options),
                "correct_index": card.correct_index,
                "transcript": card.transcript,
                "audio": f"audio/{card.media_name}",
                "source": card.source,
                "source_url": card.source_url,
            }
            for card in cards
        ],
    }


def write_assets(
    cards: list[ListeningCard],
    media_by_id: dict[str, Path],
    assets_dir: Path,
    report: dict[str, Any],
) -> None:
    audio_dir = assets_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    for card in cards:
        source = media_by_id[card.note_id]
        destination = audio_dir / card.media_name
        if source.resolve() != destination.resolve():
            shutil.copy2(source, destination)
    catalog = catalog_payload(cards, report)
    (assets_dir / "questions.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report_path = assets_dir / "pack.report.json"
    report["output_questions"] = len(cards)
    report["output_audio_bytes"] = sum(
        (audio_dir / card.media_name).stat().st_size for card in cards
    )
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--assets-dir",
        type=Path,
        default=Path("app/src/main/assets"),
        help="Android assets directory",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path(".cache"),
        help="Downloaded source, transcript pages and transcoded media cache",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Use test-01.json ... test-19.json from this local directory",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Pack only the first N eligible cards (for smoke tests)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent audio download/transcode workers",
    )
    parser.add_argument(
        "--skip-audio",
        action="store_true",
        help="Write questions.json without downloading audio",
    )
    parser.add_argument(
        "--skip-transcript-pages",
        action="store_true",
        help="Do not fetch Mandarin Zone transcript pages",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.limit is not None and args.limit < 1:
        raise ValueError("--limit must be at least 1")
    if args.workers < 1:
        raise ValueError("--workers must be at least 1")

    tests = load_source_tests(args.source_dir, args.cache_dir)
    cards, report = collect_cards(tests)
    if not args.skip_transcript_pages:
        pages = load_transcript_pages(args.cache_dir)
        cards, transcript_stats = attach_transcripts(cards, pages)
        report["transcripts"] = transcript_stats
    else:
        report["transcripts"] = {
            "with_transcript": sum(1 for card in cards if card.transcript),
            "from_json": sum(1 for card in cards if card.transcript),
            "from_pages": 0,
            "missing": sum(1 for card in cards if not card.transcript),
        }

    if args.limit is not None:
        cards = cards[: args.limit]
        report["build_limit"] = args.limit
        report["included_cards"] = len(cards)

    if args.skip_audio:
        media_by_id = {}
        args.assets_dir.mkdir(parents=True, exist_ok=True)
        catalog = catalog_payload(cards, report)
        (args.assets_dir / "questions.json").write_text(
            json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {args.assets_dir / 'questions.json'} without audio")
        return

    media_by_id = prepare_all_audio(
        cards, args.cache_dir / AUDIO_CACHE_VERSION, args.workers
    )
    write_assets(cards, media_by_id, args.assets_dir, report)
    missing = report["transcripts"]["missing"]
    print(
        f"Packed {len(cards)} questions into {args.assets_dir} "
        f"({report.get('output_audio_bytes', 0) / 1024 / 1024:.1f} MiB audio, "
        f"{missing} without transcript)",
        flush=True,
    )


if __name__ == "__main__":
    main()
