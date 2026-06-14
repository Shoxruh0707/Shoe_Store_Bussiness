const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.UI_HOST || "0.0.0.0";
const PORT = Number(process.env.UI_PORT || 3000);
const API_URL = process.env.API_URL || "http://127.0.0.1:5000";
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(req, res) {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const relativePath = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const filePath = path.normalize(path.join(publicDir, relativePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

function proxyApi(req, res) {
  const target = new URL(req.url, API_URL);
  const options = {
    method: req.method,
    hostname: target.hostname,
    port: target.port,
    path: `${target.pathname}${target.search}`,
    headers: {
      ...req.headers,
      host: target.host,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `API unavailable: ${error.message}` }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Product UI running at http://${HOST}:${PORT}`);
  console.log(`Proxying API requests to ${API_URL}`);
});
