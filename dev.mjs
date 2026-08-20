import { spawn } from "node:child_process";

let api;
try {
  await fetch("http://127.0.0.1:8787/api/linkedin");
  console.log("Using existing SQLite API at http://127.0.0.1:8787");
} catch (error) {
  api = spawn(process.execPath, ["server.cjs"], { stdio: "inherit" });
  api.on("error", startupError => console.error(`SQLite API could not start: ${startupError.message}`));
}

const vite = spawn("./node_modules/.bin/vite", ["--host", "127.0.0.1"], { stdio: "inherit" });

const stop = () => {
  api?.kill();
  vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
