# План создания `stt-player-droid`

## Итоговая архитектура

Создать автономный Android-проект в `stt-player-droid`.

- Kotlin, Jetpack Compose Material 3, Coroutines/Flow.
- Android 12+, только `arm64-v8a`; package `com.tepmex.sttplayerdroid`.
- Media3 1.10.1: ExoPlayer внутри `MediaSessionService`, фон, уведомление, Bluetooth и экран блокировки.
- Room 2.8.4 для недавних файлов, выбранных языков, позиции воспроизведения и метаданных индекса.
- LiteRT 2.1.6 `CompiledModel API`, только CPU в v1.
- Полностью локальная обработка после однократной загрузки модели; аналитики и серверного STT нет.

## Реализация

### Аудио и интерфейс

- Повторить функции PWA: MP3, TXT/HTML/EPUB/FB2, недавние файлы, главы, восстановление позиции, ±15 секунд, журнал производительности и подсветка найденного фрагмента.
- Открывать файлы через Storage Access Framework и сохранять persistable URI permission; аудиокниги не копировать во внутреннее хранилище.
- Добавить отдельную кнопку «Найти в тексте». Она мгновенно ставит воспроизведение на паузу, получает последние пять секунд и запускает синхронизацию; воспроизведение автоматически не возобновляется.
- Подключить к Media3 собственный `AudioProcessor`: downmix в mono, ресемплинг в 16 кГц и кольцевой буфер на 10 секунд. Отключить audio offload, чтобы PCM всегда проходил через процессор.
- После seek или смены файла очищать буфер. Кнопка синхронизации недоступна, пока не накоплено две секунды; короткий фрагмент дополняется тишиной.
- Текст отображать через `LazyColumn`, прокручивать по идентификатору chunk, не создавать UI для всей книги сразу.

### Whisper Tiny LiteRT

- При первом запуске показать экран установки модели и скачать `whisper_tiny_30s_i8.tflite` размером около 41 МБ из `litert-community/whisper-tiny`.
- Скачивать через foreground `CoroutineWorker` во временный файл, поддерживать retry, затем проверять SHA-256 `6748ac565a228c4a00b18d11ea1e2fd7cead3db6fba94e3f0bf35756b13ba4a9` и атомарно переносить в `noBackupFilesDir/models`.
- Повреждённую или несовместимую модель удалять и предлагать повторную загрузку. После успешной установки приложение работает офлайн.
- Встроить в APK tokenizer/config Whisper Tiny и поддержать языки `en` и `pl`; язык выбирается для книги и сохраняется.
- Адаптировать Apache-2.0 компоненты официального [LiteRT ASR sample](https://github.com/google-ai-edge/litert-samples/tree/main/samples/litert/speech_recognition): log-Mel preprocessing, `LiteRtRunner`, Whisper encoder/decoder и Hugging Face tokenizer JNI.
- Пять секунд PCM дополнять до 30-секундного входа модели. Использовать сигнатуры `encode`/`decode`, greedy decoding, language token, `transcribe`, `no_timestamps`; завершать по EOT или после 96 токенов.
- Создавать один прогретый `CompiledModel`, выполнять preprocessing и inference в отдельном single-thread dispatcher, освобождать модель только при завершении процесса или критическом memory trim.

### Книги и поиск

- TXT читать как UTF-8 с поддержкой BOM; HTML разбирать через Jsoup; EPUB — по OPF/spine из ZIP; FB2 — через `XmlPullParser`.
- Представлять книгу как главы и chunks с оригинальным текстом, номером абзаца и стабильным ID.
- Нормализовать через Unicode NFKC и `Locale.ROOT`. Хранить также folded-вариант без польских диакритических знаков для устойчивости к ошибкам STT.
- Построить индекс 2/3-грамм и редких слов. Сначала искать около последнего совпадения в диапазоне ±200 chunks, затем в выбранной главе, после этого глобально.
- Отбирать до 64 кандидатов индексом и ранжировать ordered-token alignment плюс нормализованное расстояние Левенштейна.
- Сохранять chunks в Room, а версионированный бинарный индекс — во внутреннем каталоге по SHA-256 текста. При изменении парсера или версии индекса перестраивать его в фоне.

## Основные интерфейсы

- `ModelManager`: `StateFlow<ModelState>`, загрузка, проверка и открытие модели.
- `SpeechTranscriber.transcribe(FloatArray, SttLanguage): TranscriptionResult`.
- `PcmSnapshotProvider.snapshot(seconds = 5): FloatArray?`.
- `BookParser.parse(Uri): BookDocument`.
- `TextLocator.index(BookDocument)` и `locate(query, chapterId, anchorChunkId): MatchResult?`.
- `SyncCoordinator`: единый pipeline pause → PCM → STT → search → scroll с состояниями `Idle`, `Preparing`, `Transcribing`, `Searching`, `Matched`, `Error`.
- `SttLanguage` содержит только `English(en)` и `Polish(pl)` в v1.
- `TranscriptionResult` и performance log содержат отдельные времена preprocessing, model initialization, encode, decode, search и полное tap-to-highlight.

## Проверка и критерии готовности

- Unit-тесты: stereo downmix, ресемплинг, кольцевой буфер, очистка после seek, checksum, prompt tokens EN/PL, Unicode/польские диакритики, fuzzy search и локальный приоритет.
- Parser fixtures для TXT, HTML, EPUB и FB2 с главами, пустыми секциями и повреждёнными файлами.
- Integration-тесты LiteRT на физическом arm64 Android 12+: английская и польская пятисекундные записи, пустой звук, повторный warm inference.
- UI-тесты: установка модели, retry без сети, выбор файлов, восстановление после перезапуска, выбор главы/языка, подсветка и прокрутка.
- Media-тесты: фон, блокировка экрана, Bluetooth, окончание файла, seek и восстановление позиции.
- Проверить, что размер аудиокниги не влияет на подготовку к STT, полный MP3 никогда не загружается в память, а UI остаётся отзывчивым во время парсинга, индексации и inference.
- Числовой latency-gate не вводить; журналировать результаты и сравнить tap-to-highlight с PWA на одном устройстве.
- Добавить release-сборку с R8, Baseline Profile/Macrobenchmark для запуска, открытия книги, скролла и первого/warm STT.

## Принятые ограничения

- V1 поддерживает MP3 и те же четыре текстовых формата, что PWA.
- Whisper Tiny INT8 — единственная модель; GPU/NPU и FP32 оставляются для следующей версии.
- Модель скачивается при первом запуске, tokenizer поставляется внутри APK.
- Поддерживаемые языки интерфейса STT — английский и польский.
- После загрузки модели все функции, включая распознавание, работают без сети.
