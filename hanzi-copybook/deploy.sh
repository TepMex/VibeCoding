#!/bin/zsh
bun run build &&
rm -rf ~/Experiments/Tepmex.github.io/hanzi-copybook &&
cp -R ./dist ~/Experiments/Tepmex.github.io/hanzi-copybook