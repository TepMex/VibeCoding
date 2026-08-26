# HSK 4 Listening · Android

Офлайн-приложение для аудирования HSK 4: те же 509 вопросов, что в архивной [колоде Anki](https://tepmex.github.io/VibeCoding/hsk4-listening-anki/), но в случайном порядке и с транскриптом после ответа.

APK: [hsk4-listening-anki-v2.apk](https://tepmex.github.io/VibeCoding/hsk4-listening-anki-v2/).

## Что умеет

- Показывает задания в случайном порядке.
- Проигрывает встроенное MP3 без интернета.
- После выбора варианта подсвечивает верный/неверный ответ.
- По кнопке «Показать транскрипт» открывает иероглифы того, что звучало в записи (听力原文).

Данные — адаптация набора Mandarin Zone / [hsk4-mock-exam](https://github.com/Make-dream-clear/hsk4-mock-exam), лицензия [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

## Сборка

Нужны JDK 17+, Android SDK, Python 3.11+, `ffmpeg` и сеть для исходных WAV и страниц с транскриптами.

```bash
python3 pack_assets.py
./gradlew assembleRelease
python3 -m unittest discover -s tests
./gradlew test
```

Для быстрой проверки пайплайна данных:

```bash
python3 pack_assets.py --limit 2 --skip-audio
python3 -m unittest discover -s tests
```

Аудио кладётся в `app/src/main/assets/audio/` на время сборки и не коммитится.
