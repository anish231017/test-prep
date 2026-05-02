const { requireRole } = require("./_lib/auth");
const { supabaseFetch, sendJson } = require("./_lib/supabase-rest");
const { cleanText, toSlug } = require("./_lib/questions");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await supabaseFetch(
        "/rest/v1/exams?select=id,name,slug,description,is_active&is_active=eq.true&order=name.asc",
        { headers: { Accept: "application/json" } }
      );
      return sendJson(res, 200, { exams: rows });
    }

    if (req.method === "POST") {
      await requireRole(req, ["admin"]);
      const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const name = cleanText(input.name);
      if (!name) return sendJson(res, 400, { error: "Exam name is required." });

      const row = {
        name,
        slug: toSlug(input.slug || name),
        description: cleanText(input.description),
        is_active: input.isActive !== false
      };

      const saved = await supabaseFetch("/rest/v1/exams?on_conflict=slug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(row)
      });
      return sendJson(res, 200, { exam: saved[0] });
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
