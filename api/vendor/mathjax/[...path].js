const fs = require("fs");
const path = require("path");

const MATHJAX_DIR = path.resolve(__dirname, "..", "..", "..", "node_modules", "mathjax");
const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".css": "text/css; charset=utf-8"
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed.");
  }
  const parts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const relative = parts.join("/");
  if (!relative || relative.includes("..") || path.isAbsolute(relative)) {
    res.statusCode = 400;
    return res.end("Bad vendor path.");
  }
  const filePath = path.join(MATHJAX_DIR, relative);
  if (!filePath.startsWith(MATHJAX_DIR) || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end("Not found.");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  return fs.createReadStream(filePath).pipe(res);
};
