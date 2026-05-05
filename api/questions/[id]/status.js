const { requireRole, getActor } = require("../../_lib/auth");
const { supabaseFetch, sendJson } = require("../../_lib/supabase-rest");
const { findQuestion, questionToSupabaseRow } = require("../../_lib/questions");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "PUT") return sendJson(res, 405, { error: "Method not allowed." });
    
    // Both admins and editors can perform a soft delete (status update)
    const actor = await requireRole(req, ["admin", "editor"]);
    
    const id = req.query.id;
    const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    
    // Find existing question payload
    const existing = await findQuestion(id);
    if (!existing) return sendJson(res, 404, { error: "Question not found" });
    
    // Only update the status
    existing.status = input.status || "deleted";
    
    // Save it back to Supabase
    await supabaseFetch("/rest/v1/questions?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(questionToSupabaseRow(existing, actor))
    });
    
    return sendJson(res, 200, { success: true });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
