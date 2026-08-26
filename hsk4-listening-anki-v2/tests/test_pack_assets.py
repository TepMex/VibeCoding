from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pack_assets


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
                "transcript": "男：你怎么又想换工作了？\n女：经常要加班。",
            },
            {
                "number": 46,
                "type": "reading_comprehension",
                "options": ["A", "B", "C", "D"],
                "correct_answer_index": 2,
            },
        ],
    }


class PackAssetsTests(unittest.TestCase):
    def test_encodes_non_ascii_audio_paths_without_double_encoding(self) -> None:
        raw = "https://media.mandarinzone.com/audio/41002-38题.mp3"
        encoded = "https://media.mandarinzone.com/audio/41002-38%E9%A2%98.mp3"
        self.assertEqual(pack_assets.encode_url(raw), encoded)
        self.assertEqual(pack_assets.encode_url(encoded), encoded)

    def test_collects_only_listening_cards_with_per_question_audio(self) -> None:
        no_audio = source_test()
        no_audio["_collection_test_number"] = 13
        no_audio["questions"] = [
            {
                "number": 1,
                "type": "listening_true_false",
                "text": "一句话。",
                "transcript": "今天天气非常好。",
                "options": ["对", "错"],
                "correct_answer_index": 1,
            }
        ]

        cards, report = pack_assets.collect_cards([source_test(), no_audio])

        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0].note_id, "hsk4-t01-q001")
        self.assertEqual(cards[1].options[0], "工资低")
        self.assertEqual(cards[1].transcript, "男：你怎么又想换工作了？\n女：经常要加班。")
        self.assertEqual(report["included_cards"], 2)
        self.assertEqual(report["skipped"], {"no_per_question_audio": 1})

    def test_extracts_numbered_and_question_transcript_formats(self) -> None:
        fixtures = Path(__file__).parent / "fixtures"
        numbered = pack_assets.extract_numbered_transcripts(
            (fixtures / "transcript_numbered.html").read_text(encoding="utf-8")
        )
        questions = pack_assets.extract_numbered_transcripts(
            (fixtures / "transcript_questions.html").read_text(encoding="utf-8")
        )

        self.assertEqual(numbered[1], "乘客您好，航班推迟起飞。")
        self.assertIn("没纸了", numbered[11])
        self.assertIn("问：女的为什么没收到传真？", numbered[11])
        self.assertEqual(numbered[36], numbered[37])
        self.assertIn("遇到烦恼事时", numbered[36])
        self.assertIn("这个广告可以在电视上做", numbered[38])
        self.assertEqual(questions[1], "喂？我们去树林里走走吧。")
        self.assertNotIn("Hello", questions[1])
        self.assertNotIn("Statement", questions[2])

    def test_attaches_page_transcripts_by_test_and_keeps_json(self) -> None:
        cards, _report = pack_assets.collect_cards([source_test()])
        page_html = (Path(__file__).parent / "fixtures" / "transcript_numbered.html").read_text(
            encoding="utf-8"
        )
        pages = [
            (
                "https://www.mandarinzone.com/free-online-hsk4-mock-test-1/",
                pack_assets.extract_numbered_transcripts(page_html),
                pack_assets.html_to_text(page_html) + cards[0].prompt,
            )
        ]

        filled, stats = pack_assets.attach_transcripts(cards, pages)

        self.assertEqual(filled[0].transcript, "乘客您好，航班推迟起飞。")
        self.assertEqual(filled[1].transcript, "男：你怎么又想换工作了？\n女：经常要加班。")
        self.assertEqual(stats["from_json"], 1)
        self.assertEqual(stats["from_pages"], 1)
        self.assertEqual(stats["missing"], 0)

    def test_writes_catalog_with_audio_paths(self) -> None:
        cards, report = pack_assets.collect_cards([source_test()])
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            media_dir = temporary / "media"
            media_dir.mkdir()
            media_by_id = {}
            for card in cards:
                media = media_dir / card.media_name
                media.write_bytes(b"ID3" + b"\0" * 2048)
                media_by_id[card.note_id] = media
            assets = temporary / "assets"
            report["transcripts"] = {"with_transcript": 1, "missing": 1}
            pack_assets.write_assets(cards, media_by_id, assets, report)

            catalog = json.loads((assets / "questions.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["included_cards"], 2)
            self.assertEqual(catalog["questions"][0]["audio"], "audio/hsk4-t01-q001.mp3")
            self.assertTrue((assets / "audio" / "hsk4-t01-q001.mp3").is_file())
            self.assertEqual(catalog["questions"][1]["correct_index"], 3)


if __name__ == "__main__":
    unittest.main()
