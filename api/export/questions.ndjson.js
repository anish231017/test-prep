const { requireRole } = require("../_lib/auth");
const { supabaseFetch } = require("../_lib/supabase-rest");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.statusCode = 405;
      return res.end("Method not allowed.");
    }
    await requireRole(req, ["admin"]);
    const rows = await supabaseFetch(
      "/rest/v1/questions?select=payload&order=exam.asc,year.desc,paper.asc,question_number.asc",
      { headers: { Accept: "application/json" } }
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"questions.ndjson\"");
    return res.end(rows.map((row) => JSON.stringify(row.payload)).join("\n"));
  } catch (error) {
    res.statusCode = error.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message }));
  }
};
