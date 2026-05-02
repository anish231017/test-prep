function cleanEnv(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function getSupabaseEnv() {
  const url = cleanEnv(process.env.SUPABASE_URL);
  const anonKey = cleanEnv(process.env.SUPABASE_ANON_KEY);
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bucket = cleanEnv(process.env.SUPABASE_STORAGE_BUCKET) || "question-assets";

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return { url, anonKey, serviceRoleKey, bucket };
}

module.exports = {
  cleanEnv,
  getSupabaseEnv
};
