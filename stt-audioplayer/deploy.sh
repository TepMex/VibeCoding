#!/bin/zsh
bun run build &&
rm -rf ~/Experiments/Tepmex.github.io/stt-player &&
cp -R ./dist ~/Experiments/Tepmex.github.io/stt-player