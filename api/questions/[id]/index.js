const { requireRole } = require("../../_lib/auth");
const { supabaseFetch, sendJson } = require("../../_lib/supabase-rest");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "DELETE") return sendJson(res, 405, { error: "Method not allowed." });
    await requireRole(req, ["admin"]);
    const id = req.query.id;
    const deleted = await supabaseFetch(`/rest/v1/questions?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    });
    return sendJson(res, deleted.length ? 200 : 404, { deleted: deleted.length > 0 });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
