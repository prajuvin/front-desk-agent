/* Local preview without Vercel: `node server.js`, then open http://localhost:3000 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const handler = require("./api/chat.js");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const PUBLIC = path.join(__dirname, "public");

http.createServer((req, res) => {
  if (req.url.startsWith("/api/chat")) {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on("end", () => { req.body = raw; handler(req, res); });
    return;
  }
  const file = path.normalize(path.join(PUBLIC, req.url === "/" ? "index.html" : req.url.split("?")[0]));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("Front Desk on http://localhost:" + (process.env.PORT || 3000)));
