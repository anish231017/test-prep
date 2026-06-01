const PYQAuth = (() => {
  const storageKey = "pyq.supabase.session";
  let configPromise = null;

  function getStoredSession() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  }

  function setStoredSession(session) {
    if (session) {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch("/api/config").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load auth config.");
        return data;
      });
    }
    return configPromise;
  }

  async function signIn(email, password) {
    const config = await getConfig();
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || data.error || "Sign in failed.");
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user
    };
    setStoredSession(session);
    return session;
  }

  function signOut() {
    setStoredSession(null);
  }

  async function authFetch(url, options = {}) {
    const session = getStoredSession();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
      }
    });
  }

  async function fetchJson(url, options = {}) {
    const response = await authFetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function me() {
    const session = getStoredSession();
    if (!session?.accessToken) return null;
    const data = await fetchJson("/api/me");
    return data.user;
  }

  function renderAuthBar({ required = false, adminOnly = false, onChange } = {}) {
    const host = document.querySelector("[data-auth-bar]");
    if (!host) return;
    host.innerHTML = `
      <form class="authForm" data-auth-form>
        <input type="email" data-auth-email placeholder="Editor email" autocomplete="email" required />
        <div class="authPasswordWrapper" style="position: relative; display: flex; align-items: center;">
          <input type="password" data-auth-password placeholder="Password" autocomplete="current-password" required style="padding-right: 48px;" />
          <button type="button" data-auth-toggle-password style="position: absolute; right: 8px; border: none; background: none; color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; letter-spacing: 0.05em; padding: 4px;" title="Toggle Password Visibility">Show</button>
        </div>
        <button type="submit">Sign in</button>
      </form>
      <div class="authStatus" data-auth-status></div>
    `;

    const form = host.querySelector("[data-auth-form]");
    const status = host.querySelector("[data-auth-status]");
    const toggleBtn = host.querySelector("[data-auth-toggle-password]");
    const passwordInput = host.querySelector("[data-auth-password]");

    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "Hide" : "Show";
      });
    }

    async function refresh() {
      const actor = await me().catch(() => null);
      if (!actor) {
        host.style.display = "";
        form.hidden = false;
        status.innerHTML = required ? `<span class="authWarning">Sign in to continue.</span>` : "";
        document.querySelector(".topbar .stats [data-auth-topbar-user]")?.remove();
        document.querySelector(".topbar .stats [data-auth-topbar-signout]")?.remove();
        onChange?.(null);
        return;
      }
      
      host.style.display = "none";
      
      const stats = document.querySelector(".topbar .stats");
      if (stats) {
        stats.querySelector("[data-auth-topbar-user]")?.remove();
        stats.querySelector("[data-auth-topbar-signout]")?.remove();
        stats.insertAdjacentHTML(
          "beforeend",
          `<span data-auth-topbar-user style="color: #d1d5db; font-size: 13px; margin-left: 12px;">${actor.email} (${actor.role})</span>
           <a href="#" data-auth-topbar-signout style="color: #ff8888; font-weight: 700; text-decoration: none; margin-left: 8px;">Sign out</a>`
        );
        stats.querySelector("[data-auth-topbar-signout]").addEventListener("click", (e) => {
          e.preventDefault();
          signOut();
          refresh();
        });
      }
      
      onChange?.(actor);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = host.querySelector("[data-auth-email]").value;
      const password = host.querySelector("[data-auth-password]").value;
      try {
        await signIn(email, password);
        await refresh();
        if (typeof window.showToast === "function") {
          window.showToast("Login successful. Welcome back!");
        }
      } catch (error) {
        status.innerHTML = `<span class="authWarning">${error.message}</span>`;
      }
    });

    refresh();
  }

  return {
    authFetch,
    fetchJson,
    getStoredSession,
    me,
    renderAuthBar,
    signIn,
    signOut
  };
})();

window.PYQAuth = PYQAuth;
