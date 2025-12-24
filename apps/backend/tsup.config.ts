import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"], // your backend entry
    format: ["esm"],
    outDir: "dist",
    target: "node18",
    clean: true,

    // IMPORTANT for React Email
    jsx: "automatic",
    external: ["react", "react-dom"],

    sourcemap: true
});
