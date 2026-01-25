# Make Me a Hanzi data

Download `graphics.txt` from the Make Me a Hanzi dataset and place it in this
folder as `graphics.txt`.

Source: https://www.skishore.me/makemeahanzi/

Then run:

```bash
bun scripts/build-hanzi-data.ts
```

This will generate per-character JSON files in `public/hanzi-data/` for lazy
loading at runtime.
