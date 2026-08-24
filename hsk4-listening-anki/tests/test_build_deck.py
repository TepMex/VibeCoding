from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

import build_deck


def source_test() -> dict:
    return {
        "_collection_test_number": 1,
        "quiz_id": 2,
        "title": "HSK 4 Sample",
        "source": "Mandarin Zone",
        "questions": [
            {
                "number": 1,
                "type": "listening_true_false",
                "audio": "https://media.mandarinzone.com/one.wav",
                "text": "他们去植物园了。",
                "options": ["对", "错"],
                "correct_answer_index": 0,
            },
            {
                "number": 11,
                "type": "listening_choice",
                "audio": "https://media.mandarinzone.com/eleven.wav",
                "text": "女的为什么想换工作？",
                "options": ["A 工资低", "B 离家远", "C 想读博士", "D 想多陪孩子"],
                "correct_answer_index": 3,
            },
            {
                "number": 46,
                "type": "reading_comprehension",
                "options": ["A", "B", "C", "D"],
                "correct_answer_index": 2,
            },
        ],
    }


class BuildDeckTests(unittest.TestCase):
    def test_encodes_non_ascii_audio_paths_without_double_encoding(self) -> None:
        raw = "https://media.mandarinzone.com/audio/41002-38题.mp3"
        encoded = "https://media.mandarinzone.com/audio/41002-38%E9%A2%98.mp3"

        self.assertEqual(build_deck.encode_url(raw), encoded)
        self.assertEqual(build_deck.encode_url(encoded), encoded)

    def test_collects_only_listening_cards_with_per_question_audio(self) -> None:
        no_audio = source_test()
        no_audio["_collection_test_number"] = 13
        no_audio["questions"] = [
            {
                "number": 1,
                "type": "listening_true_false",
                "text": "一句话。",
                "options": ["对", "错"],
                "correct_answer_index": 1,
            }
        ]

        cards, report = build_deck.collect_cards([source_test(), no_audio])

        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0].note_id, "hsk4-t01-q001")
        self.assertEqual(cards[1].options[0], "工资低")
        self.assertEqual(report["included_cards"], 2)
        self.assertEqual(report["skipped"], {"no_per_question_audio": 1})

    def test_models_have_required_names_and_interactive_templates(self) -> None:
        true_false, choice = build_deck.make_models()

        self.assertEqual(true_false.name, "HSK Listening TrueFalse")
        self.assertEqual(choice.name, "HSK Listening Choice")
        for model in (true_false, choice):
            question = model.templates[0]["qfmt"]
            answer = model.templates[0]["afmt"]
            self.assertIn("sessionStorage.setItem", question)
            self.assertIn("{{FrontSide}}", answer)
            self.assertIn("data-correct", answer)
            self.assertIn("is-correct", model.css)

    def test_writes_importable_package_with_both_note_types(self) -> None:
        cards, report = build_deck.collect_cards([source_test()])
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            media_files = []
            for card in cards:
                media = temporary / card.media_name
                media.write_bytes(b"ID3" + b"\0" * 2048)
                media_files.append(media)
            output = temporary / "deck.apkg"

            build_deck.write_package(cards, media_files, output, report)

            self.assertTrue(output.is_file())
            with zipfile.ZipFile(output) as package:
                names = set(package.namelist())
                self.assertIn("collection.anki2", names)
                media_map = json.loads(package.read("media"))
                self.assertEqual(set(media_map.values()), {card.media_name for card in cards})
                package.extract("collection.anki2", temporary)

            connection = sqlite3.connect(temporary / "collection.anki2")
            try:
                model_json = connection.execute("SELECT models FROM col").fetchone()[0]
                model_names = {model["name"] for model in json.loads(model_json).values()}
                note_count = connection.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
            finally:
                connection.close()

            self.assertEqual(
                model_names,
                {"HSK Listening TrueFalse", "HSK Listening Choice"},
            )
            self.assertEqual(note_count, 2)


if __name__ == "__main__":
    unittest.main()
