const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  target: "node18",
  logLevel: "info",
};

async function main() {
  if (isWatch) {
    const extCtx = await esbuild.context(extensionConfig);
    await extCtx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(extensionConfig);
    console.log("Build complete!");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
