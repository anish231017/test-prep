const fs = require("fs");
const path = require("path");

const PAPERS_DIR = path.resolve(__dirname, "..", "Jee Advance");

function safePaperPath(year, file) {
  const yearPart = String(year || "");
  const filePart = String(file || "");
  if (!/^\d{4}$/.test(yearPart) || filePart.includes("..") || /[\\/]/.test(filePart)) {
    return null;
  }
  const resolved = path.join(PAPERS_DIR, yearPart, filePart);
  return resolved.startsWith(PAPERS_DIR) ? resolved : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed.");
  }
  const filePath = safePaperPath(req.query.year, req.query.file);
  if (!filePath || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end("Paper not found.");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  return fs.createReadStream(filePath).pipe(res);
};
