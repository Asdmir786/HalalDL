const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const host = process.argv[3] || "127.0.0.1";
const port = Number(process.argv[4] || 4173);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath, fallbackToIndex = false) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (fallbackToIndex) {
        return sendFile(res, path.join(root, "index.html"), false);
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const reqPath = (req.url || "/").split("?")[0];
    const safePath = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
    const filePath = path.join(root, safePath);
    sendFile(res, filePath, true);
  })
  .listen(port, host, () => {
    console.log(`release promo server listening on http://${host}:${port}`);
    console.log(`serving ${root}`);
  });
