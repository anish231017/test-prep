const { getActor } = require("./_lib/auth");
const { sendJson } = require("./_lib/supabase-rest");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
    const actor = await getActor(req);
    return sendJson(res, 200, { user: actor });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
