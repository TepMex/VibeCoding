# Anki Dashboard

Modern local-first dashboard for Anki review history. The same React interface
runs on the web and in the signed Android APK.

## Features

- Download-only AnkiWeb sync on Android (sync protocol v11, zstd, shard redirects).
- No AnkiDroid integration and no access to AnkiDroid storage.
- Local `collection.anki2` analysis in a Web Worker with sql.js/WASM.
- Deck and subdeck selection, retention, review speed, study time, long-memory
  cards, current/historical review debt, review/mistake heatmaps, vocabulary
  charts, and configurable leech fields.
- Browser import of `collection.anki2`; direct AnkiWeb sync stays native because
  AnkiWeb does not allow browser CORS requests.
- Material UI responsive layout, dark mode, and Android-first sizing.

The app only downloads. It never uploads collection changes, and the AnkiWeb
password is used for the login request without being persisted.

## Development

Requires Bun, JDK 17+, and Android SDK 36.

```bash
bun install
bun run dev
bun run build
bun run android:debug
bun run android:release
```

Release APK:
`android/app/build/outputs/apk/release/app-release.apk`.

Release and debug APKs use the repository sideload certificate, so a newly
published APK can be installed over the previous version. This certificate is
for direct distribution only, not Google Play.

## Web and APK

The deploy workflow publishes both artifacts under:

- `/VibeCoding/anki-dashboard/`
- `/VibeCoding/anki-dashboard/anki-dashboard.apk`

## Attribution

The AnkiWeb sync flow is adapted from the MIT-licensed
`CloudAgenticCoding/anki-dashboard-apk` implementation. The dashboard is based
on `TepMex/anki-dashboard`.
