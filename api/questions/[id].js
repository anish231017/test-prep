const { requireRole, getActor } = require("../_lib/auth");
const { supabaseFetch, sendJson } = require("../_lib/supabase-rest");
const { findQuestion, questionToSupabaseRow } = require("../_lib/questions");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "DELETE") {
      // Hard delete: Only admins
      await requireRole(req, ["admin"]);
      const id = req.query.id;
      const deleted = await supabaseFetch(`/rest/v1/questions?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" }
      });
      return sendJson(res, deleted.length ? 200 : 404, { deleted: deleted.length > 0 });
    }
    
    if (req.method === "PUT") {
      // Soft delete / status update: Admins and editors
      const actor = await requireRole(req, ["admin", "editor"]);
      const id = req.query.id;
      const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      
      const existing = await findQuestion(id);
      if (!existing) return sendJson(res, 404, { error: "Question not found" });
      
      existing.status = input.status || "deleted";
      
      await supabaseFetch("/rest/v1/questions?on_conflict=id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(questionToSupabaseRow(existing, actor))
      });
      
      return sendJson(res, 200, { success: true });
    }
    
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
