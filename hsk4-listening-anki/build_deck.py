#!/usr/bin/env python3
"""Build an offline Anki deck from the HSK 4 mock exam dataset."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
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
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import genanki

SOURCE_COMMIT = "5fe9a65173a4b9aa8aae7c513ea279b10bc64023"
SOURCE_REPOSITORY = "https://github.com/Make-dream-clear/hsk4-mock-exam"
SOURCE_RAW_ROOT = (
    f"https://raw.githubusercontent.com/Make-dream-clear/"
    f"hsk4-mock-exam/{SOURCE_COMMIT}/data"
)
SOURCE_LICENSE = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
ALLOWED_AUDIO_HOST = "media.mandarinzone.com"
DECK_NAME = "HSK 4 Listening"
OUTPUT_NAME = "hsk4-listening.apkg"
QUESTION_TYPES = {"listening_true_false", "listening_choice"}
AUDIO_BITRATE = "40k"
AUDIO_SAMPLE_RATE = 32000
AUDIO_CACHE_VERSION = "mp3-mono-32khz-40k"
GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024

TRUE_FALSE_MODEL_ID = 2059400101
CHOICE_MODEL_ID = 2059400102
DECK_ID_BASE = 2059400200


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


CARD_CSS = r"""
:root {
  --hsk-bg: #f5f2eb;
  --hsk-surface: #fffdf8;
  --hsk-text: #17221d;
  --hsk-muted: #66736c;
  --hsk-border: #d8ded9;
  --hsk-accent: #176b52;
  --hsk-accent-soft: #e3f2ec;
  --hsk-correct: #137047;
  --hsk-correct-soft: #e1f4e9;
  --hsk-wrong: #b33c34;
  --hsk-wrong-soft: #fae7e4;
}

.card {
  margin: 0;
  padding: 0;
  background: var(--hsk-bg);
  color: var(--hsk-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC",
    "PingFang SC", "Microsoft YaHei", sans-serif;
  text-align: left;
}

.nightMode {
  --hsk-bg: #121815;
  --hsk-surface: #1b2420;
  --hsk-text: #edf3ef;
  --hsk-muted: #a9b5ae;
  --hsk-border: #35433c;
  --hsk-accent: #62c5a1;
  --hsk-accent-soft: #203d33;
  --hsk-correct: #73d6a5;
  --hsk-correct-soft: #203f30;
  --hsk-wrong: #ff9289;
  --hsk-wrong-soft: #492b2a;
}

* {
  box-sizing: border-box;
}

.hsk-card {
  width: min(100%, 42rem);
  min-height: 100vh;
  margin: 0 auto;
  padding: 1rem;
}

.hsk-shell {
  overflow: hidden;
  background: var(--hsk-surface);
  border: 1px solid var(--hsk-border);
  border-radius: 1.1rem;
  box-shadow: 0 0.5rem 2rem rgba(18, 38, 29, 0.08);
}

.hsk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1rem 0;
  color: var(--hsk-muted);
  font-size: 0.78rem;
}

.hsk-level {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--hsk-accent-soft);
  color: var(--hsk-accent);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.hsk-counter {
  text-align: right;
}

.hsk-content {
  padding: 1.15rem 1rem 1.25rem;
}

.hsk-instruction {
  margin: 0 0 0.75rem;
  color: var(--hsk-muted);
  font-size: 0.86rem;
}

.hsk-audio {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  margin-bottom: 1.1rem;
  padding: 0.6rem;
  border: 1px solid var(--hsk-border);
  border-radius: 0.8rem;
  background: var(--hsk-bg);
}

.hsk-audio .soundLink,
.hsk-audio .replaybutton {
  color: var(--hsk-accent);
}

.hsk-prompt {
  margin: 0 0 1.15rem;
  font-size: clamp(1.15rem, 4.5vw, 1.55rem);
  font-weight: 650;
  line-height: 1.55;
}

.hsk-options {
  display: grid;
  gap: 0.65rem;
}

.hsk-option {
  display: grid;
  grid-template-columns: 2rem 1fr;
  align-items: center;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.65rem 0.8rem;
  border: 1.5px solid var(--hsk-border);
  border-radius: 0.8rem;
  background: transparent;
  color: var(--hsk-text);
  font: inherit;
  font-size: 1rem;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.hsk-option:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--hsk-accent) 38%, transparent);
  outline-offset: 2px;
}

.hsk-option.is-selected {
  border-color: var(--hsk-accent);
  background: var(--hsk-accent-soft);
}

.hsk-option.is-correct {
  border-color: var(--hsk-correct);
  background: var(--hsk-correct-soft);
}

.hsk-option.is-wrong {
  border-color: var(--hsk-wrong);
  background: var(--hsk-wrong-soft);
}

.hsk-option-key {
  display: inline-grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid var(--hsk-border);
  border-radius: 50%;
  color: var(--hsk-muted);
  font-size: 0.76rem;
  font-weight: 750;
}

.hsk-option-text {
  padding-left: 0.35rem;
}

.hsk-status {
  min-height: 1.3rem;
  margin: 0.8rem 0 0;
  color: var(--hsk-muted);
  font-size: 0.8rem;
  text-align: center;
}

.hsk-card.is-answer .hsk-option {
  cursor: default;
  pointer-events: none;
}

.hsk-answer {
  width: min(calc(100% - 2rem), 40rem);
  margin: 0 auto 1rem;
  padding: 1rem;
  border: 1px solid var(--hsk-border);
  border-radius: 1rem;
  background: var(--hsk-surface);
}

.hsk-result {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
  font-weight: 750;
}

.hsk-result.is-correct {
  color: var(--hsk-correct);
}

.hsk-result.is-wrong {
  color: var(--hsk-wrong);
}

.hsk-answer-line {
  margin: 0.35rem 0 0;
  line-height: 1.5;
}

.hsk-answer-label {
  color: var(--hsk-muted);
  font-size: 0.82rem;
}

.hsk-source {
  margin: 0.9rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hsk-border);
  color: var(--hsk-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}

.hsk-source a {
  color: var(--hsk-accent);
}

@media (min-width: 38rem) {
  .hsk-card {
    padding: 1.5rem;
  }

  .hsk-header {
    padding: 1.2rem 1.35rem 0;
  }

  .hsk-content {
    padding: 1.3rem 1.35rem 1.5rem;
  }
}
"""


def option_button(index: int, field: str, key: str) -> str:
    return (
        f'{{{{#{field}}}}}<button class="hsk-option" type="button" '
        f'data-choice="{index}" aria-pressed="false">'
        f'<span class="hsk-option-key">{key}</span>'
        f'<span class="hsk-option-text">{{{{{field}}}}}</span>'
        f"</button>{{{{/{field}}}}}"
    )


def front_template(instruction: str, prompt_field: str, options: list[tuple[str, str]]) -> str:
    buttons = "\n".join(
        option_button(index, field, key)
        for index, (field, key) in enumerate(options)
    )
    return f"""
<main class="hsk-card" data-note-id="{{{{ID}}}}">
  <section class="hsk-shell">
    <header class="hsk-header">
      <span class="hsk-level">HSK 4 · 听力</span>
      <span class="hsk-counter">Test {{{{TestNumber}}}} · № {{{{QuestionNumber}}}}</span>
    </header>
    <div class="hsk-content">
      <p class="hsk-instruction">{instruction}</p>
      <div class="hsk-audio">{{{{Audio}}}}</div>
      {{{{#{prompt_field}}}}}<h1 class="hsk-prompt">{{{{{prompt_field}}}}}</h1>{{{{/{prompt_field}}}}}
      <div class="hsk-options" role="group" aria-label="Варианты ответа">
        {buttons}
      </div>
      <p class="hsk-status" aria-live="polite">Выберите ответ, затем нажмите «Показать ответ»</p>
    </div>
  </section>
</main>
<script>
(function () {{
  var root = document.querySelector('.hsk-card[data-note-id="{{{{ID}}}}"]');
  if (!root) return;
  var storageKey = "hsk4-listening:" + root.dataset.noteId;
  var buttons = root.querySelectorAll(".hsk-option");
  var status = root.querySelector(".hsk-status");
  function save(value) {{
    try {{
      sessionStorage.setItem(storageKey, value);
    }} catch (error) {{
      window.hsk4ListeningAnswers = window.hsk4ListeningAnswers || {{}};
      window.hsk4ListeningAnswers[storageKey] = value;
    }}
  }}
  function select(button) {{
    for (var i = 0; i < buttons.length; i += 1) {{
      buttons[i].classList.remove("is-selected");
      buttons[i].setAttribute("aria-pressed", "false");
    }}
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
    save(button.dataset.choice);
    if (status) status.textContent = "Ответ выбран · нажмите «Показать ответ»";
  }}
  for (var i = 0; i < buttons.length; i += 1) {{
    buttons[i].addEventListener("click", function () {{ select(this); }});
  }}
}})();
</script>
"""


def back_template() -> str:
    return """
{{FrontSide}}
<section class="hsk-answer" id="answer" data-correct="{{CorrectIndex}}">
  <p class="hsk-result" data-result>Правильный ответ: {{CorrectAnswer}}</p>
  <p class="hsk-answer-line">
    <span class="hsk-answer-label">Ваш ответ</span><br>
    <span data-selected-answer>Не выбран</span>
  </p>
  <p class="hsk-answer-line">
    <span class="hsk-answer-label">Правильный ответ</span><br>
    <strong>{{CorrectAnswer}}</strong>
  </p>
  <p class="hsk-source">
    {{Source}} ·
    <a href="{{SourceURL}}">исходные данные</a> ·
    <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>
  </p>
</section>
<script>
(function () {
  var root = document.querySelector('.hsk-card[data-note-id="{{ID}}"]');
  var answer = document.querySelector(".hsk-answer");
  if (!root || !answer) return;
  root.classList.add("is-answer");
  var storageKey = "hsk4-listening:" + root.dataset.noteId;
  var selected = null;
  try {
    selected = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
  } catch (error) {
    if (window.hsk4ListeningAnswers) {
      selected = window.hsk4ListeningAnswers[storageKey];
      delete window.hsk4ListeningAnswers[storageKey];
    }
  }
  var correct = answer.dataset.correct;
  var buttons = root.querySelectorAll(".hsk-option");
  var selectedText = answer.querySelector("[data-selected-answer]");
  var result = answer.querySelector("[data-result]");
  for (var i = 0; i < buttons.length; i += 1) {
    buttons[i].disabled = true;
    buttons[i].classList.remove("is-selected");
    if (buttons[i].dataset.choice === correct) buttons[i].classList.add("is-correct");
    if (selected !== null && buttons[i].dataset.choice === selected) {
      selectedText.textContent = buttons[i].querySelector(".hsk-option-text").textContent;
      if (selected !== correct) buttons[i].classList.add("is-wrong");
    }
  }
  if (selected === correct) {
    result.textContent = "✓ Верно";
    result.classList.add("is-correct");
  } else if (selected === null) {
    result.textContent = "Ответ не выбран";
  } else {
    result.textContent = "✕ Неверно";
    result.classList.add("is-wrong");
  }
})();
</script>
"""


TRUE_FALSE_FIELDS = [
    "ID",
    "Audio",
    "Statement",
    "TrueOption",
    "FalseOption",
    "CorrectIndex",
    "CorrectAnswer",
    "TestNumber",
    "QuestionNumber",
    "Source",
    "SourceURL",
]

CHOICE_FIELDS = [
    "ID",
    "Audio",
    "Question",
    "OptionA",
    "OptionB",
    "OptionC",
    "OptionD",
    "CorrectIndex",
    "CorrectAnswer",
    "TestNumber",
    "QuestionNumber",
    "Source",
    "SourceURL",
]


def make_models() -> tuple[genanki.Model, genanki.Model]:
    true_false = genanki.Model(
        TRUE_FALSE_MODEL_ID,
        "HSK Listening TrueFalse",
        fields=[{"name": name} for name in TRUE_FALSE_FIELDS],
        templates=[
            {
                "name": "Listening True / False",
                "qfmt": front_template(
                    "听录音，然后判断正误 · Прослушайте и выберите 对 или 错",
                    "Statement",
                    [("TrueOption", "对"), ("FalseOption", "错")],
                ),
                "afmt": back_template(),
            }
        ],
        css=CARD_CSS,
        sort_field_index=0,
    )
    choice = genanki.Model(
        CHOICE_MODEL_ID,
        "HSK Listening Choice",
        fields=[{"name": name} for name in CHOICE_FIELDS],
        templates=[
            {
                "name": "Listening Choice",
                "qfmt": front_template(
                    "听录音，选择正确答案 · Прослушайте и выберите правильный ответ",
                    "Question",
                    [
                        ("OptionA", "A"),
                        ("OptionB", "B"),
                        ("OptionC", "C"),
                        ("OptionD", "D"),
                    ],
                ),
                "afmt": back_template(),
            }
        ],
        css=CARD_CSS,
        sort_field_index=0,
    )
    return true_false, choice


def fetch_json(url: str, destination: Path) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "VibeCoding-HSK4-Anki/1.0"})
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
            destination.write_bytes(payload)
            return json.loads(payload)
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2**attempt)
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


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


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return html.escape(str(value).strip()).replace("\n", "<br>")


def normalize_option(value: Any, question_type: str) -> str:
    option = str(value).strip()
    if question_type == "listening_choice":
        option = re.sub(r"^[A-DＡ-Ｄ][.．、:\s]+", "", option, count=1)
    return option


def collect_cards(
    tests: Iterable[dict[str, Any]],
) -> tuple[list[ListeningCard], dict[str, Any]]:
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
            parsed_audio_url = urllib.parse.urlparse(str(audio_url))
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
                question_type=question_type,
                audio_url=str(audio_url),
                prompt=str(question.get("text", "")).strip(),
                options=options,
                correct_index=correct_index,
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
            "HSK Listening TrueFalse": by_type["listening_true_false"],
            "HSK Listening Choice": by_type["listening_choice"],
        },
        "included_by_test": {
            f"{test_number:02d}": count for test_number, count in sorted(by_test.items())
        },
        "skipped": dict(skipped),
    }
    return cards, report


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
        encode_url(url), headers={"User-Agent": "VibeCoding-HSK4-Anki/1.0"}
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
    source_suffix = Path(urllib.parse.urlparse(card.audio_url).path).suffix or ".audio"
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
) -> list[Path]:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to build the deck")
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
    return [media_by_id[card.note_id] for card in cards]


def source_label(card: ListeningCard) -> str:
    return clean_text(card.source)


def note_fields(card: ListeningCard) -> list[str]:
    common_tail = [
        str(card.correct_index),
        clean_text(card.options[card.correct_index]),
        f"{card.test_number:02d}",
        str(card.question_number),
        source_label(card),
        card.source_url,
    ]
    if card.question_type == "listening_true_false":
        return [
            card.note_id,
            f"[sound:{card.media_name}]",
            clean_text(card.prompt),
            clean_text(card.options[0]),
            clean_text(card.options[1]),
            *common_tail,
        ]
    return [
        card.note_id,
        f"[sound:{card.media_name}]",
        clean_text(card.prompt),
        *(clean_text(option) for option in card.options),
        *common_tail,
    ]


def write_package(
    cards: list[ListeningCard],
    media_files: list[Path],
    output: Path,
    report: dict[str, Any],
) -> None:
    true_false_model, choice_model = make_models()
    decks: dict[int, genanki.Deck] = {}
    grouped_cards: dict[int, list[ListeningCard]] = defaultdict(list)
    for card in cards:
        grouped_cards[card.test_number].append(card)

    description = (
        "<p>HSK 4 listening practice generated from "
        f'<a href="{SOURCE_REPOSITORY}/tree/{SOURCE_COMMIT}">'
        "Mandarin Zone's HSK 4 Mock Exam dataset</a>.</p>"
        f'<p>Adapted under <a href="{SOURCE_LICENSE}">CC BY-NC-SA 4.0</a>. '
        "Non-commercial use only.</p>"
    )
    for test_number, test_cards in sorted(grouped_cards.items()):
        deck = genanki.Deck(
            DECK_ID_BASE + test_number,
            f"{DECK_NAME}::Test {test_number:02d}",
            description=description,
        )
        decks[test_number] = deck
        for card in test_cards:
            model = (
                true_false_model
                if card.question_type == "listening_true_false"
                else choice_model
            )
            note = genanki.Note(
                model=model,
                fields=note_fields(card),
                guid=genanki.guid_for(card.note_id),
                tags=[
                    "HSK4",
                    "listening",
                    "true_false"
                    if card.question_type == "listening_true_false"
                    else "choice",
                    f"test_{card.test_number:02d}",
                ],
            )
            deck.add_note(note)

    output.parent.mkdir(parents=True, exist_ok=True)
    package = genanki.Package(list(decks.values()))
    package.media_files = [str(path) for path in media_files]
    package.write_to_file(str(output))
    if output.stat().st_size >= GITHUB_MAX_FILE_BYTES:
        raise RuntimeError(
            f"{output} is {output.stat().st_size} bytes and exceeds GitHub's "
            f"{GITHUB_MAX_FILE_BYTES}-byte per-file limit"
        )
    report["output_file"] = output.name
    report["output_bytes"] = output.stat().st_size
    report_path = output.with_suffix(".report.json")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist") / OUTPUT_NAME,
        help="Destination .apkg file",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path(".cache"),
        help="Downloaded source and transcoded media cache",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Use test-01.json ... test-19.json from this local directory",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Build only the first N eligible cards (for smoke tests)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent audio download/transcode workers",
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
    if args.limit is not None:
        cards = cards[: args.limit]
        report["build_limit"] = args.limit
        report["included_cards"] = len(cards)
        limited_counts = Counter(card.question_type for card in cards)
        report["included_by_note_type"] = {
            "HSK Listening TrueFalse": limited_counts["listening_true_false"],
            "HSK Listening Choice": limited_counts["listening_choice"],
        }
        limited_tests = Counter(card.test_number for card in cards)
        report["included_by_test"] = {
            f"{test_number:02d}": count
            for test_number, count in sorted(limited_tests.items())
        }

    media_files = prepare_all_audio(
        cards, args.cache_dir / AUDIO_CACHE_VERSION, args.workers
    )
    write_package(cards, media_files, args.output, report)
    print(
        f"Built {args.output} with {len(cards)} cards "
        f"({args.output.stat().st_size / 1024 / 1024:.1f} MiB)"
    )


if __name__ == "__main__":
    main()
