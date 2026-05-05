const fs_promises = require("fs/promises");
const fs = require("fs");
const path = require("path");
const { sendJson } = require("./_lib/supabase-rest");

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
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
    
    // Download mode
    if (req.query.action === "download" || req.query.file) {
      const filePath = safePaperPath(req.query.year, req.query.file);
      if (!filePath || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        return res.end("Paper not found.");
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      return fs.createReadStream(filePath).pipe(res);
    }
    
    // Listing mode
    let years;
    try {
      years = await fs_promises.readdir(PAPERS_DIR, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return sendJson(res, 200, { papers: [] });
      throw err;
    }
    
    const result = [];
    for (const year of years.filter((entry) => entry.isDirectory())) {
      const files = await fs_promises.readdir(path.join(PAPERS_DIR, year.name), { withFileTypes: true });
      for (const file of files.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))) {
        result.push({
          exam: "JEE Advanced",
          year: Number(year.name),
          paper: file.name.replace(/\.pdf$/i, ""),
          fileName: file.name,
          url: `/api/paper?year=${encodeURIComponent(year.name)}&file=${encodeURIComponent(file.name)}`
        });
      }
    }
    result.sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper, undefined, { numeric: true }));
    return sendJson(res, 200, { papers: result });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
