const { getSupabaseEnv } = require("./env");
const { supabaseFetch } = require("./supabase-rest");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : "";
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const env = getSupabaseEnv();
  const response = await fetch(`${env.url}/auth/v1/user`, {
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function getActor(req) {
  const user = await getAuthenticatedUser(req);
  if (!user?.id) return null;

  const rows = await supabaseFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role&limit=1`,
    { headers: { Accept: "application/json" } }
  );
  const profile = rows[0];
  if (!profile) return null;
  return {
    id: user.id,
    email: profile.email || user.email,
    role: profile.role
  };
}

async function requireRole(req, roles) {
  const actor = await getActor(req);
  if (!actor || !roles.includes(actor.role)) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
  return actor;
}

module.exports = {
  getActor,
  requireRole
};
