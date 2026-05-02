const { getSupabaseEnv } = require("./_lib/env");
const { sendJson } = require("./_lib/supabase-rest");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
    const env = getSupabaseEnv();
    return sendJson(res, 200, {
      supabaseUrl: env.url,
      supabaseAnonKey: env.anonKey
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
