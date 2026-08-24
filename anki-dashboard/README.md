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
- An i + 1 vocabulary tab built from well-known hanzi and HSK 2.0, HSK 3.0,
  and SUBTLEX-CH lists, with one-tap Pleco lookups.
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

Chinese vocabulary lists come from
[`TepMex/cjk-lists`](https://github.com/TepMex/cjk-lists). SUBTLEX-CH data is
from Cai, Q., & Brysbaert, M. (2010), *PLOS ONE*, 5(6), e10729
([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
