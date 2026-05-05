const { getActor } = require("./_lib/auth");
const { getSupabaseEnv } = require("./_lib/env");
const { sendJson } = require("./_lib/supabase-rest");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
    
    const route = req.query.route;
    
    if (route === "me") {
      const actor = await getActor(req);
      return sendJson(res, 200, { user: actor });
    }
    
    if (route === "backend") {
      const env = getSupabaseEnv();
      return sendJson(res, 200, {
        backend: "supabase",
        storage: "supabase-storage",
        hasBucket: !!env.bucket
      });
    }
    
    if (route === "config") {
      const env = getSupabaseEnv();
      return sendJson(res, 200, {
        supabaseUrl: env.url,
        supabaseAnonKey: env.anonKey
      });
    }
    
    return sendJson(res, 404, { error: "Info route not found." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
