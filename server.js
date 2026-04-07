const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, url.pathname);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Study abroad advisor running at http://${HOST}:${PORT}`);
});
