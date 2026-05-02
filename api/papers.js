const fs = require("fs/promises");
const path = require("path");
const { sendJson } = require("./_lib/supabase-rest");

const PAPERS_DIR = path.resolve(__dirname, "..", "Jee Advance");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
    const years = await fs.readdir(PAPERS_DIR, { withFileTypes: true });
    const result = [];
    for (const year of years.filter((entry) => entry.isDirectory())) {
      const files = await fs.readdir(path.join(PAPERS_DIR, year.name), { withFileTypes: true });
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
