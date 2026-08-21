# Physical device test matrix

Эти сценарии нельзя достоверно проверить JVM-тестом или x86 emulator: нужен физический `arm64-v8a` Android 12+.

## LiteRT

- Установить модель по Wi-Fi, сверить прогресс и успешный offline restart.
- Оборвать сеть в середине загрузки: WorkManager retry/resume, затем checksum success.
- EN: пятисекундная запись → осмысленный transcript → highlight.
- PL: пятисекундная запись с диакритиками → folded fuzzy match.
- Тишина → пустой transcript/error без ложного highlight.
- Два последовательных запуска → второй без model initialization; сравнить `init/encode/decode/total` в журнале.
- Подменить модель повреждённым файлом → удаление и экран повторной установки.

## Media

- Playback в фоне и при выключенном экране; уведомление и lock-screen metadata/actions.
- Bluetooth play/pause и seek; системные ±10 секунд в уведомлении / lock screen.
- Cold start / playback resumption: после убийства сервиса System UI / BT play поднимает `PlaybackService` через `MediaButtonReceiver` + `onPlaybackResumption` и продолжает с сохранённой позиции (если это было последнее аудиоприложение).
- После reboot: System UI должен показать resumption-уведомление (контракт `MediaBrowserService` / `MediaLibraryService`); play в уведомлении или на наушниках поднимает тот же `onPlaybackResumption` и продолжает с сохранённой позиции.
- Позиция пишется в Room раз в 30 с во время play; каждая пауза — сразу с `lastPausedAt` и событием `pause`; любой seek сохраняет destination; seek ≥ 5 минут дополнительно пишет событие `seek_origin` с начальной точкой.
- Seek по таймлайну в UI и seek из system notification / lock screen не должны ронять процесс; после перезапуска позиция = точка seek.
- Seek и смена MP3 очищают PCM: «Найти» disabled до новых двух секунд.
- Конец MP3, принудительное закрытие UI и повторный запуск сохраняют позицию.
- Большой MP3: memory profiler не показывает загрузку полного файла, STT preparation не зависит от размера.

## UI/books

- Выбрать TXT/HTML/EPUB/FB2 через SAF, перезапустить и открыть из «Недавних» без повторной выдачи доступа.
- Переключить главу и EN/PL, перезапустить и проверить восстановление.
- Проверить scroll/highlight на большой книге и отсутствие composition всех chunks одновременно.
- Во время parsing/indexing/STT проверить scroll/input responsiveness и отсутствие ANR.

## Macrobenchmark

На release/benchmark build выполнить startup, открытие книги, длинный scroll, первый и warm STT. Числовой gate не задавать; сравнить tap-to-highlight с PWA на том же устройстве.

