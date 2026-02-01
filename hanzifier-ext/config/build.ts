import Bun, { $, Glob } from "bun";
import { resolve } from "node:path";

import "./cwd";
import manifest from "../public/manifest.json";

const outdir = "./build";

const {
  content_scripts,
  background: { service_worker },
} = manifest;

const scripts = content_scripts.flatMap((script) => script.js);

const resolveEntryPoints = (entrypoints: string[]) => {
  return entrypoints.map((entrypoint) => `./src/${entrypoint}`);
};

const publicFolder = "./public";
const dataListsFolder = "./data/processed/lists";

await $`rm -rf ${outdir}`;

const ext = {
  html: ".html",
  png: ".png",
  css: ".css",
};

const muiEsmPlugin = {
  name: "mui-esm-aliases",
  setup(build: Bun.PluginBuilder) {
    build.onResolve({ filter: /^@mui\/system\/createStyled$/ }, () => ({
      path: resolve("node_modules/@mui/system/esm/createStyled.js"),
    }));
  },
};

await Bun.build({
  target: "browser",
  plugins: [muiEsmPlugin],
  entrypoints: resolveEntryPoints([
    ...scripts,
    service_worker,
    "options/index.tsx",
    "popup/index.tsx",
  ]),
  outdir,
});

const glob = new Glob("**");

const mainCssFile = Bun.file(`${publicFolder}/main.css`);

if (!mainCssFile.exists()) throw new Error("main.css not found");

for await (const filename of glob.scan(publicFolder)) {
  const file = Bun.file(`${publicFolder}/${filename}`);

  if (!file.exists()) throw new Error(`File ${filename} does not exist`);

  if (filename.endsWith(ext.png) || filename.endsWith(ext.css)) continue;

  if (filename.endsWith(ext.html)) {
    const fileFolder = filename.replace(ext.html, "");

    // rename files to index.html since it's being copied into a folder that share its original name
    await $`cp ${file.name} ${outdir}/${fileFolder}/index.html`;
    // copy the css file into the folder
    await $`bun run css -- ${mainCssFile.name} -o ${outdir}/${fileFolder}/main.css`.quiet();
  } else {
    await $`cp ${file.name} ${outdir}`;
  }
}

await $`cp -R ${publicFolder}/icons ${outdir}`;

await $`mkdir -p ${outdir}/data/processed`;
await $`cp -R ${dataListsFolder} ${outdir}/data/processed/`;
