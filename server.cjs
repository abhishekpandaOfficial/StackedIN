const http = require("node:http");
const { DatabaseSync } = require("node:sqlite");

const database = new DatabaseSync("dashboard.sqlite");
database.exec(`CREATE TABLE IF NOT EXISTS linkedin_status (
  post_id INTEGER PRIMARY KEY,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
const readStatuses = database.prepare("SELECT post_id, published FROM linkedin_status");
const writeStatus = database.prepare(`INSERT INTO linkedin_status (post_id, published, updated_at)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(post_id) DO UPDATE SET published = excluded.published, updated_at = CURRENT_TIMESTAMP`);

const send = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  response.end(JSON.stringify(body));
};

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return response.end();
  }
  if (request.method === "GET" && request.url === "/api/linkedin") {
    const statuses = Object.fromEntries(readStatuses.all().map(row => [row.post_id, Boolean(row.published)]));
    return send(response, 200, statuses);
  }
  const match = request.url.match(/^\/api\/posts\/(\d+)\/linkedin$/);
  if (request.method === "PUT" && match) {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        writeStatus.run(Number(match[1]), payload.published ? 1 : 0);
        send(response, 200, { ok: true, published: Boolean(payload.published) });
      } catch (error) {
        send(response, 400, { error: error.message });
      }
    });
    return;
  }
  send(response, 404, { error: "Not found" });
});

server.listen(8787, "127.0.0.1", () => console.log("SQLite API listening on http://127.0.0.1:8787"));
