const { getSupabaseEnv } = require("./env");

async function supabaseFetch(route, options = {}, keyType = "service") {
  const env = getSupabaseEnv();
  const key = keyType === "anon" ? env.anonKey : env.serviceRoleKey;
  if (!key) throw new Error(`Missing Supabase ${keyType} key.`);

  const response = await fetch(`${env.url}${route}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase request failed: ${response.status}`);
  }
  return data;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function methodNotAllowed(res) {
  res.setHeader("Allow", "GET,POST,DELETE");
  sendJson(res, 405, { error: "Method not allowed." });
}

module.exports = {
  supabaseFetch,
  sendJson,
  methodNotAllowed
};
