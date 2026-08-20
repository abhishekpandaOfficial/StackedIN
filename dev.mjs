import { spawn } from "node:child_process";

const api = spawn(process.execPath, ["server.cjs"], { stdio: "inherit" });
const vite = spawn("./node_modules/.bin/vite", ["--host", "127.0.0.1"], { stdio: "inherit" });

const stop = () => {
  api.kill();
  vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
