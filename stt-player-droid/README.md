# STT Player Droid

Автономный Android-плеер, который распознаёт последние пять секунд аудиокниги локальной Whisper Tiny и находит соответствующий фрагмент в тексте.

## Возможности

- Android 12+ (`minSdk 31`), Kotlin, Compose Material 3, только `arm64-v8a`.
- MP3 через Media3 `MediaSessionService`: фон, системное media-уведомление с ±10 с, lock screen и Bluetooth controls.
- Playback resumption (как системный cold start): `MediaButtonReceiver` + `onPlaybackResumption` поднимают последний трек с сохранённой позиции.
- Прогресс в Room: раз в 30 с во время play, сразу на паузе (с timestamp), на каждом seek (destination), и origin при seek ≥ 5 минут.
- SAF без копирования аудиокниги, persistable URI, недавние книги/MP3 и восстановление позиции.
- TXT (UTF-8/BOM), HTML, EPUB (OPF/spine) и FB2; главы и ленивый список chunks.
- Собственный Media3 `AudioProcessor`: stereo downmix, потоковый ресемплинг 16 кГц, 10-секундный ring buffer; offload отключён.
- Кнопка «Найти в тексте»: pause → последние 5 секунд PCM → log-Mel → LiteRT `encode`/`decode` → fuzzy search → scroll/highlight. Автовозобновления нет.
- Whisper Tiny INT8 загружается foreground `CoroutineWorker`, поддерживает retry/range resume, проверку SHA-256 и атомарную установку в `noBackupFilesDir/models`.
- LiteRT 2.1.6 `CompiledModel`, CPU-only, один прогретый instance, greedy decoding до 96 tokens; English и Polski.
- Встроенные `tokenizer.json` и arm64 Hugging Face tokenizer JNI.
- Room хранит недавние URI, язык, главу, позицию, chunks, anchor и performance log. Бинарный индекс версионирован и привязан к SHA-256 текста.
- 2/3-граммы и редкие слова дают не больше 64 кандидатов; поиск идёт `anchor ±200` → глава → вся книга и учитывает польские диакритики.
- R8 release, startup baseline profile и отдельный Macrobenchmark-модуль.

Модель после успешной установки — единственный сетевой ресурс. Аналитики, серверного STT и сетевых вызовов при распознавании нет.

## Сборка

Нужны JDK 17+, Android SDK 36, NDK 28.2 и CMake 3.22.1.

```bash
./gradlew testDebugUnitTest assembleDebug
./gradlew assembleRelease lintDebug
```

Release (и debug) подписываются committed **sideload keystore** (`sideload.keystore` + `sideload-signing.properties`), чтобы каждый CI/локальный билд использовал один и тот же ключ и новый APK ставился **поверх** предыдущего. Не для Play Store.

APK: `app/build/outputs/apk/release/app-release.apk`.

Опционально: переопределить подпись через `sttplayerdroid.signing*` в `local.properties`.

### Обновление на телефоне

1. Скачайте свежий `stt-player-droid.apk` с GitHub Pages и установите поверх текущего приложения.
2. Если Android отказывает (например, стояла сборка с другим ключом) — один раз удалите приложение, поставьте новый APK; дальше обновления снова встанут поверх.

## CI и скачивание

При пуше в `master` workflow `.github/workflows/deploy.yml` собирает release APK, проверяет sideload-подпись и публикует на GitHub Pages:

- лендинг: `/VibeCoding/stt-player-droid/`
- APK: `/VibeCoding/stt-player-droid/stt-player-droid.apk`

## Тесты

JVM/Robolectric tests покрывают downmix, цельный и потоковый ресемплинг, ring buffer/clear, SHA-256, prompt tokens EN/PL, NFKC/польский folding, fuzzy/local priority и TXT/HTML/EPUB/FB2, включая пустые секции и повреждённый EPUB.

Instrumentation содержит clean-install UI smoke test. `benchmark` содержит Baseline Profile generator и cold-start Macrobenchmark. Проверки, требующие физического arm64 Android 12+ и реальной модели/аудио, перечислены в [device test matrix](docs/DEVICE_TEST_MATRIX.md).

## Модель

- Зеркало (приоритет): `https://tepmex.github.io/VibeCoding/stt-player-droid/whisper_tiny_30s_i8.tflite`
- Upstream: `litert-community/whisper-tiny/whisper_tiny_30s_i8.tflite`
- SHA-256: `6748ac565a228c4a00b18d11ea1e2fd7cead3db6fba94e3f0bf35756b13ba4a9`
- tokenizer: `openai/whisper-tiny/tokenizer.json`, встроен в APK

При установке приложение сначала качает зеркало с GitHub Pages, при ошибке — Hugging Face. CI публикует тот же файл рядом с APK.

## Лицензии

JNI tokenizer и структура LiteRT runner адаптированы из официального Apache-2.0 LiteRT ASR sample. Подробности — в [NOTICE](NOTICE).

