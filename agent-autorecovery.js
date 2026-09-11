// Super Lovable — vigia de retomada autônoma orientada pelo estado persistido..
// A política e os checkpoints pertencem ao github-agent-panel. Este arquivo apenas
// acorda o orquestrador após recarga/recriação do painel; não procura nem clica botões.
(() => {
  // if (globalThis.__superLovableAutoRecoveryLoaded) return;
  globalThis.__superLovableAutoRecoveryLoaded = true;

  const TASK_KEY = "sl_agent_batch_task_v1";
  let wakeTimer = null;

  function scheduleWake(delay = 250) {
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(async () => {
      wakeTimer = null;
      try {
        await globalThis.superLovableGithubAgentResumePending?.();
      } catch {
        // O painel exibe erros sanitizados e mantém o checkpoint para a próxima
        // retomada. O vigia não duplica logs nem decisões de recuperação.
      }
    }, delay);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[TASK_KEY]?.newValue) return;
    scheduleWake();
  });

  async function fetchPosts() {
    try {
      const { supabase } = globalThis.__slSupabase || {};
      if (supabase && typeof supabase.from === "function") {
        const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          return { posts: data, source: "supabase" };
        }
      }
    } catch {}
    const cached = localStorage.getItem("sl_feed_posts");
    if (cached) {
      try { return { posts: JSON.parse(cached), source: "localStorage" }; } catch {}
    }
    return null;
  }

  function restorePersistedData() {
    try {
      const feed = localStorage.getItem("sl_feed_posts");
      const profile = localStorage.getItem("sl_profile");
      if (feed || profile) {
        window.postMessage({ type: "sl_restore_data", feed: feed ? JSON.parse(feed) : null, profile: profile ? JSON.parse(profile) : null }, "*");
      }
    } catch {}
  }

  // Garante que o estado das postagens não seja substituído por array
  // vazio ao recarregar a página (F5). Só restaura se houver dados
  // persistidos; caso contrário, mantém o estado anterior intacto.
  function guardAgainstEmptyReset(posts) {
    if (Array.isArray(posts) && posts.length === 0) {
      const cached = localStorage.getItem("sl_feed_posts");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
      return null; // não retorna array vazio — preserva estado anterior
    }
    return posts;
  }

  window.addEventListener("pageshow", () => { scheduleWake(500); restorePersistedData(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleWake(300);
  });

  // Cobre a recriação do side panel pelo Chrome sem acoplar a retomada ao DOM.
  setInterval(() => scheduleWake(0), 3_000);
  // scheduleWake(700);
})();
