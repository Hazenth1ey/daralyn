/* =========================================================
   Dara & Leakhena — Studio
   The back office. Signs in with GitHub (via the shared
   OAuth worker), then reads/writes the site's JSON content
   straight through the GitHub Contents API. Every publish
   is a commit; the deploy pipeline puts it live.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = {
    repo: "Hazenth1ey/daralyn",
    branch: "claude/wedding-retrospective-website-p6hlb7",
    chaptersPath: "data/chapters.json",
    tracksPath: "data/tracks.json",
    sitePath: "data/site.json",
    photosDir: "media/photos",
    audioDir: "media/audio",
    authBase: "https://aquietroom-auth.ivankolly.workers.dev",
  };
  const TOKEN_KEY = "dl_studio_token";
  const THEME_KEY = "dl_studio_theme";
  const DRAFT_KEY = "dl_studio_draft";
  const MOODS = ["dawn", "hymn", "still", "amber", "pulse", "ember"];

  const state = {
    token: null,
    editor: null,
    chapters: { sha: null, list: [], loaded: false, orderDirty: false },
    editing: null, // index into chapters.list, or null = new
    draft: { id: null, time: "", photos: [] },
    tracks: { sha: null, list: [] },
    site: { sha: null, data: {} },
  };

  const $ = (sel) => document.querySelector(sel);

  /* ---------------- utilities ---------------- */
  const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));
  const b64decode = (b64) => decodeURIComponent(escape(atob(String(b64).replace(/\n/g, ""))));

  function slugify(s) {
    return (
      String(s || "").toLowerCase().trim()
        .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "untitled"
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function toast(msg, isErr) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast" + (isErr ? " err" : "");
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.hidden = true), 3200);
  }

  function setStatus(msg, cls) {
    const el = $("#save-status");
    el.textContent = msg || "";
    el.className = "save-status" + (cls ? " " + cls : "");
  }

  function fileToB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------------- GitHub API ---------------- */
  async function gh(path, options) {
    options = options || {};
    const res = await fetch("https://api.github.com" + path, {
      ...options,
      headers: {
        Authorization: "token " + state.token,
        Accept: "application/vnd.github+json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      logout();
      throw new Error("Session expired — please sign in again.");
    }
    return res;
  }

  async function getUser() {
    const res = await gh("/user");
    if (!res.ok) throw new Error("Could not load your GitHub account.");
    return res.json();
  }

  async function getFile(path) {
    const res = await gh(`/repos/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`);
    if (res.status === 404) return { sha: null, raw: null };
    if (!res.ok) throw new Error("Could not open " + path);
    const json = await res.json();
    return { sha: json.sha, raw: b64decode(json.content) };
  }

  async function putFile(path, contentStr, message, sha) {
    const body = { message, content: b64encode(contentStr), branch: CONFIG.branch };
    if (sha) body.sha = sha;
    const res = await gh(`/repos/${CONFIG.repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Save failed.");
    }
    return res.json();
  }

  async function uploadAsset(file, dir) {
    setStatus("Uploading…");
    const ext = (file.name && file.name.split(".").pop() || "bin").toLowerCase();
    const base = slugify((file.name || "file").replace(/\.[^.]+$/, ""));
    const name = `${Date.now()}-${base}.${ext}`;
    const path = `${dir}/${name}`;
    const b64 = await fileToB64(file);
    const res = await gh(`/repos/${CONFIG.repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Upload ${name}`, content: b64, branch: CONFIG.branch }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus("");
      throw new Error(err.message || "Upload failed.");
    }
    setStatus("Uploaded", "ok");
    return `/${path}`;
  }

  /* ---------------- auth (shared OAuth worker) ---------------- */
  function login() {
    $("#login-error").hidden = true;
    const w = 620, h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const authOrigin = new URL(CONFIG.authBase).origin;
    const popup = window.open(
      `${CONFIG.authBase}/auth?provider=github&scope=repo&site_id=${location.hostname}`,
      "dl-oauth",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popup) { loginError("Please allow pop-ups for this site, then try again."); return; }

    function receive(e) {
      if (!e.data || typeof e.data !== "string") return;
      if (e.data === "authorizing:github") { popup.postMessage(e.data, authOrigin); return; }
      const okPrefix = "authorization:github:success:";
      const errPrefix = "authorization:github:error:";
      if (e.data.indexOf(okPrefix) === 0) {
        cleanup();
        let payload = {};
        try { payload = JSON.parse(e.data.slice(okPrefix.length)); } catch (x) {}
        if (payload.token) finishLogin(payload.token);
        else loginError("No token received. Please try again.");
      } else if (e.data.indexOf(errPrefix) === 0) {
        cleanup();
        loginError(e.data.slice(errPrefix.length) || "Sign-in failed.");
      }
    }
    function cleanup() {
      window.removeEventListener("message", receive);
      try { popup.close(); } catch (x) {}
    }
    window.addEventListener("message", receive);
  }

  function loginError(msg) {
    const el = $("#login-error");
    el.textContent = msg;
    el.hidden = false;
  }

  async function finishLogin(token) {
    state.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    await start();
  }

  function logout() {
    state.token = null;
    localStorage.removeItem(TOKEN_KEY);
    $("#app").hidden = true;
    $("#login").hidden = false;
  }

  /* ---------------- views ---------------- */
  function switchView(name) {
    document.querySelectorAll(".nav-item").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.view === name)
    );
    $("#view-write").hidden = name !== "write";
    $("#view-list").hidden = name !== "list";
    $("#view-sound").hidden = name !== "sound";
    $("#view-site").hidden = name !== "site";
    $("#crumb").textContent =
      name === "list" ? "Chapters"
      : name === "sound" ? "Soundtrack"
      : name === "site" ? "Site"
      : "Write";
    if (name === "write") { resizeEditor(); syncFieldHeights(); }
    if (name === "list") renderChapterList();
    if (name === "sound") loadTracks();
    if (name === "site") loadSite();
  }

  /* ---------------- chapters ---------------- */
  async function loadChapters(force) {
    if (state.chapters.loaded && !force) return;
    const { sha, raw } = await getFile(CONFIG.chaptersPath);
    state.chapters.sha = sha;
    state.chapters.list = raw ? JSON.parse(raw) : [];
    state.chapters.loaded = true;
    state.chapters.orderDirty = false;
  }

  async function saveChaptersFile(message) {
    const content = JSON.stringify(state.chapters.list, null, 2) + "\n";
    const res = await putFile(CONFIG.chaptersPath, content, message, state.chapters.sha);
    state.chapters.sha = res.content && res.content.sha;
  }

  async function renderChapterList() {
    const box = $("#post-list");
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      await loadChapters();
    } catch (e) {
      box.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
      return;
    }
    const list = state.chapters.list;
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<p class="muted">No chapters yet — write the first one.</p>';
      return;
    }
    const chevron = (dir) =>
      `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? "M5 14.5 12 8l7 6.5" : "M5 9.5 12 16l7-6.5"}"/></svg>`;
    list.forEach((c, i) => {
      const photos = (c.photos || []).length;
      const row = document.createElement("div");
      row.className = "post-row";
      row.innerHTML =
        `<div class="pr-main"><h4>${String(i + 1).padStart(2, "0")} · ${escapeHtml(c.title || "Untitled")}</h4>` +
        `<div class="pr-meta">${escapeHtml(c.time || "—")} · ${photos} photo${photos === 1 ? "" : "s"}</div></div>` +
        `<span class="track-move">` +
        `<button type="button" class="tr-up" title="Move up"${i === 0 ? " disabled" : ""}>${chevron(-1)}</button>` +
        `<button type="button" class="tr-down" title="Move down"${i === list.length - 1 ? " disabled" : ""}>${chevron(1)}</button>` +
        `</span>` +
        `<button class="pr-del" title="Delete">✕</button>`;
      row.querySelector(".pr-main").addEventListener("click", () => openChapter(i));
      row.querySelector(".tr-up").addEventListener("click", () => moveChapter(i, -1));
      row.querySelector(".tr-down").addEventListener("click", () => moveChapter(i, 1));
      row.querySelector(".pr-del").addEventListener("click", async () => {
        if (!confirm(`Delete “${c.title}”?`)) return;
        try {
          await loadChapters(true);
          state.chapters.list.splice(i, 1);
          await saveChaptersFile(`Delete chapter: ${c.title}`);
          toast("Chapter deleted.");
          renderChapterList();
        } catch (e) { toast(e.message, true); }
      });
      box.appendChild(row);
    });
    $("#order-save").hidden = !state.chapters.orderDirty;
  }

  function moveChapter(i, d) {
    const j = i + d;
    const list = state.chapters.list;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    state.chapters.orderDirty = true;
    renderChapterList();
  }

  async function saveOrder() {
    try {
      setStatus("Saving…");
      $("#order-save").disabled = true;
      await saveChaptersFile("Reorder chapters");
      state.chapters.orderDirty = false;
      $("#order-save").hidden = true;
      setStatus("Saved", "ok");
      toast("Order saved — live in about a minute.");
    } catch (e) {
      setStatus("Save failed", "err");
      toast(e.message, true);
    } finally {
      $("#order-save").disabled = false;
    }
  }

  /* ---------------- write (chapter editor) ---------------- */
  function resetForm() {
    state.editing = null;
    state.draft = { id: null, time: "", photos: [] };
    $("#f-title").value = "";
    $("#f-line").value = "";
    $("#f-time").value = "";
    $("#delete-btn").hidden = true;
    if (state.editor) state.editor.setMarkdown("");
    renderPhotos();
    syncFieldHeights();
    setStatus("");
  }

  function newChapter() {
    clearLocalDraft();
    resetForm();
    switchView("write");
    $("#f-title").focus();
  }

  function openChapter(i) {
    const c = state.chapters.list[i];
    state.editing = i;
    state.draft = { id: c.id, time: c.time || "", photos: JSON.parse(JSON.stringify(c.photos || [])) };
    $("#f-title").value = c.title || "";
    $("#f-line").value = c.line || "";
    $("#f-time").value = c.time || "";
    $("#delete-btn").hidden = false;
    state.editor.setMarkdown(c.body || "");
    renderPhotos();
    syncFieldHeights();
    markCleanDraft();
    setStatus("");
    switchView("write");
  }

  function collect() {
    const line = (v) => v.replace(/\s*\n\s*/g, " ").trim();
    return {
      id: state.draft.id, // set at publish for new chapters
      time: $("#f-time").value.trim(),
      title: line($("#f-title").value),
      line: line($("#f-line").value),
      body: state.editor.getMarkdown().trim(),
      photos: state.draft.photos,
    };
  }

  async function publishChapter() {
    const c = collect();
    if (!c.title) { toast("Give the chapter a title.", true); $("#f-title").focus(); return; }
    if (!c.id) {
      c.id = slugify(c.title);
      // keep ids unique — tracks point at them
      const taken = new Set(state.chapters.list.map((x) => x.id));
      let candidate = c.id, n = 2;
      while (taken.has(candidate)) candidate = `${c.id}-${n++}`;
      c.id = candidate;
    }
    try {
      setStatus("Publishing…");
      $("#publish-btn").disabled = true;
      await loadChapters(true); // fresh sha + list, then upsert
      const idx = state.chapters.list.findIndex((x) => x.id === c.id);
      if (idx === -1) state.chapters.list.push(c);
      else state.chapters.list[idx] = c;
      await saveChaptersFile(`${idx === -1 ? "Add" : "Update"} chapter: ${c.title}`);
      state.editing = state.chapters.list.findIndex((x) => x.id === c.id);
      state.draft.id = c.id;
      $("#delete-btn").hidden = false;
      markCleanDraft();
      setStatus("Published", "ok");
      toast("Published — live in about a minute.");
    } catch (e) {
      setStatus("Save failed", "err");
      toast(e.message, true);
    } finally {
      $("#publish-btn").disabled = false;
    }
  }

  async function deleteChapter() {
    if (!state.draft.id) return;
    const title = $("#f-title").value.trim() || "this chapter";
    if (!confirm(`Delete “${title}”? This can't be undone from here.`)) return;
    try {
      await loadChapters(true);
      const idx = state.chapters.list.findIndex((x) => x.id === state.draft.id);
      if (idx !== -1) {
        state.chapters.list.splice(idx, 1);
        await saveChaptersFile(`Delete chapter: ${title}`);
      }
      toast("Chapter deleted.");
      newChapter();
    } catch (e) {
      toast(e.message, true);
    }
  }

  /* ---------------- photos ---------------- */
  function renderPhotos() {
    const grid = $("#photo-grid");
    grid.innerHTML = "";
    const arr = state.draft.photos;
    arr.forEach((p, i) => {
      const cell = document.createElement("div");
      cell.className = "gallery-cell";
      const img = document.createElement("img");
      if (p.src) img.src = p.src;
      else { img.alt = "no image"; img.style.minHeight = "60px"; img.style.background = "rgba(157,176,216,0.06)"; }
      cell.appendChild(img);

      const cap = document.createElement("input");
      cap.className = "gallery-cap";
      cap.placeholder = "caption";
      cap.value = p.caption || "";
      cap.addEventListener("input", (e) => (p.caption = e.target.value));
      cell.appendChild(cap);

      const size = document.createElement("select");
      size.className = "core-select";
      [["", "normal"], ["wide", "wide"], ["tall", "tall"]].forEach(([v, label]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = label;
        if ((p.span || "") === v) o.selected = true;
        size.appendChild(o);
      });
      size.addEventListener("change", (e) => {
        if (e.target.value) p.span = e.target.value;
        else delete p.span;
      });
      cell.appendChild(size);

      const tools = document.createElement("div");
      tools.className = "gallery-tools";
      const mk = (label, fn, disabled) => {
        const b = document.createElement("button");
        b.className = "blk-btn";
        b.textContent = label;
        if (disabled) b.disabled = true;
        b.addEventListener("click", fn);
        return b;
      };
      tools.appendChild(mk("↑", () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); renderPhotos(); }, i === 0));
      tools.appendChild(mk("↓", () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); renderPhotos(); }, i === arr.length - 1));
      tools.appendChild(mk("✕", () => { arr.splice(i, 1); renderPhotos(); }));
      cell.appendChild(tools);
      grid.appendChild(cell);
    });
    if (!arr.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No photos yet.";
      grid.appendChild(p);
    }
  }

  async function addPhotos(files) {
    for (const file of files) {
      try {
        const url = await uploadAsset(file, CONFIG.photosDir);
        state.draft.photos.push({ src: url, caption: "" });
        renderPhotos();
      } catch (e) {
        toast(e.message, true);
        break;
      }
    }
    if (files.length) toast("Photos uploaded — Publish to put them on the site.");
  }

  /* ---------------- soundtrack ---------------- */
  async function loadTracks() {
    const box = $("#track-list");
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      await loadChapters(); // for the chapter selects
      const { sha, raw } = await getFile(CONFIG.tracksPath);
      state.tracks.sha = sha;
      state.tracks.list = raw ? JSON.parse(raw) : [];
      renderTracks();
    } catch (e) {
      box.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
    }
  }

  function renderTracks() {
    const box = $("#track-list");
    const list = state.tracks.list;
    if (!list.length) {
      box.innerHTML = '<p class="muted">No tracks yet. Add one to give the day a sound.</p>';
      return;
    }
    box.innerHTML = "";
    const chevron = (dir) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? "M5 14.5 12 8l7 6.5" : "M5 9.5 12 16l7-6.5"}"/></svg>`;
    list.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "track-row";
      row.innerHTML =
        `<span class="track-ord">${i + 1}</span>` +
        `<input class="track-title" value="${escapeHtml(t.title || "")}" placeholder="Track title" />` +
        `<input class="track-title" value="${escapeHtml(t.artist || "")}" placeholder="Label (e.g. Processional)" />`;

      const mood = document.createElement("select");
      mood.className = "core-select";
      MOODS.forEach((m) => {
        const o = document.createElement("option");
        o.value = m; o.textContent = m;
        if ((t.mood || "dawn") === m) o.selected = true;
        mood.appendChild(o);
      });
      mood.addEventListener("change", (e) => (t.mood = e.target.value));

      const chap = document.createElement("select");
      chap.className = "core-select";
      const none = document.createElement("option");
      none.value = ""; none.textContent = "no chapter";
      chap.appendChild(none);
      state.chapters.list.forEach((c) => {
        const o = document.createElement("option");
        o.value = c.id; o.textContent = c.title || c.id;
        if (t.chapter === c.id) o.selected = true;
        chap.appendChild(o);
      });
      chap.addEventListener("change", (e) => {
        if (e.target.value) t.chapter = e.target.value;
        else delete t.chapter;
      });

      const src = document.createElement("span");
      src.className = "track-src";
      src.title = t.src || "";
      src.textContent = t.src ? (t.src.split("/").pop() || t.src) : "generative";

      const move = document.createElement("span");
      move.className = "track-move";
      move.innerHTML =
        `<button type="button" class="tr-up" title="Move up"${i === 0 ? " disabled" : ""}>${chevron(-1)}</button>` +
        `<button type="button" class="tr-down" title="Move down"${i === list.length - 1 ? " disabled" : ""}>${chevron(1)}</button>`;

      const del = document.createElement("button");
      del.className = "pr-del";
      del.title = "Remove";
      del.textContent = "✕";

      row.appendChild(mood);
      row.appendChild(chap);
      row.appendChild(src);
      row.appendChild(move);
      row.appendChild(del);

      const inputs = row.querySelectorAll("input.track-title");
      inputs[0].addEventListener("input", (e) => (t.title = e.target.value));
      inputs[1].addEventListener("input", (e) => (t.artist = e.target.value));
      move.querySelector(".tr-up").addEventListener("click", () => moveTrack(i, -1));
      move.querySelector(".tr-down").addEventListener("click", () => moveTrack(i, 1));
      del.addEventListener("click", () => { list.splice(i, 1); renderTracks(); });

      box.appendChild(row);
    });
  }

  function moveTrack(i, d) {
    const j = i + d;
    const list = state.tracks.list;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    renderTracks();
  }

  function addSynthTrack() {
    state.tracks.list.push({ id: `track-${Date.now()}`, title: "Untitled", artist: "", mood: "dawn", src: null });
    renderTracks();
  }

  async function addUploadTrack(file) {
    try {
      const url = await uploadAsset(file, CONFIG.audioDir);
      const title = (file.name || "Track").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      state.tracks.list.push({ id: slugify(title) + "-" + Date.now(), title, artist: "", mood: "dawn", src: url });
      renderTracks();
      toast("Track uploaded. Save soundtrack to publish.");
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function saveTracks() {
    try {
      setStatus("Saving…");
      $("#track-save").disabled = true;
      const content = JSON.stringify(state.tracks.list, null, 2) + "\n";
      const res = await putFile(CONFIG.tracksPath, content, "Update soundtrack", state.tracks.sha);
      state.tracks.sha = res.content && res.content.sha;
      setStatus("Saved", "ok");
      toast("Soundtrack saved — live in about a minute.");
    } catch (e) {
      setStatus("Save failed", "err");
      toast(e.message, true);
    } finally {
      $("#track-save").disabled = false;
    }
  }

  /* ---------------- site ---------------- */
  async function loadSite() {
    try {
      const { sha, raw } = await getFile(CONFIG.sitePath);
      state.site.sha = sha;
      state.site.data = raw ? JSON.parse(raw) : {};
      const d = state.site.data;
      $("#s-one").value = (d.couple && d.couple.one) || "";
      $("#s-two").value = (d.couple && d.couple.two) || "";
      $("#s-date").value = d.date || "";
      $("#s-place").value = d.place || "";
      $("#s-epigraph").value = d.epigraph || "";
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function saveSite() {
    try {
      setStatus("Saving…");
      $("#site-save").disabled = true;
      const d = state.site.data || {};
      d.couple = { one: $("#s-one").value.trim() || "Dara", two: $("#s-two").value.trim() || "Leakhena" };
      d.date = $("#s-date").value.trim() || "—";
      d.place = $("#s-place").value.trim() || "—";
      d.epigraph = $("#s-epigraph").value.trim();
      const content = JSON.stringify(d, null, 2) + "\n";
      const res = await putFile(CONFIG.sitePath, content, "Update site details", state.site.sha);
      state.site.sha = res.content && res.content.sha;
      setStatus("Saved", "ok");
      toast("Site details saved — live in about a minute.");
    } catch (e) {
      setStatus("Save failed", "err");
      toast(e.message, true);
    } finally {
      $("#site-save").disabled = false;
    }
  }

  /* ---------------- local draft safety net ---------------- */
  let lastDraftJson = "";

  function draftSnapshot() {
    if (!state.editor) return null;
    try {
      return {
        id: state.draft.id,
        title: $("#f-title").value,
        line: $("#f-line").value,
        time: $("#f-time").value,
        photos: state.draft.photos,
        body: state.editor.getMarkdown(),
      };
    } catch (e) { return null; }
  }

  function autosaveTick() {
    if ($("#view-write").hidden) return;
    const snap = draftSnapshot();
    if (!snap) return;
    const json = JSON.stringify(snap);
    if (json === lastDraftJson) return;
    lastDraftJson = json;
    const empty = !snap.title && !snap.body.trim() && !snap.line && !snap.photos.length;
    try {
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, json);
    } catch (e) {}
  }

  function clearLocalDraft() {
    lastDraftJson = "";
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  function markCleanDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    const snap = draftSnapshot();
    lastDraftJson = snap ? JSON.stringify(snap) : "";
  }

  function restoreLocalDraft() {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (!snap || (!snap.title && !(snap.body || "").trim())) return false;
    state.draft = { id: snap.id || null, time: snap.time || "", photos: snap.photos || [] };
    state.editing = null;
    $("#f-title").value = snap.title || "";
    $("#f-line").value = snap.line || "";
    $("#f-time").value = snap.time || "";
    $("#delete-btn").hidden = !snap.id;
    try { state.editor.setMarkdown(snap.body || ""); } catch (e) {}
    renderPhotos();
    syncFieldHeights();
    lastDraftJson = JSON.stringify(snap);
    return true;
  }

  /* ---------------- editor ---------------- */
  function currentTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  function editorHeight() {
    const el = $("#editor");
    const top = el ? el.getBoundingClientRect().top : 260;
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    return Math.max(300, window.innerHeight - top - (mobile ? 92 : 36)) + "px";
  }

  function resizeEditor() {
    if (state.editor && !$("#view-write").hidden) {
      try { state.editor.setHeight(editorHeight()); } catch (e) {}
    }
  }

  function fallbackEditor(el, initialMd) {
    const ta = document.createElement("textarea");
    ta.className = "editor-fallback";
    ta.placeholder = "Write in Markdown…";
    ta.value = initialMd || "";
    el.appendChild(ta);
    return {
      getMarkdown: () => ta.value,
      setMarkdown: (v) => { ta.value = v == null ? "" : v; },
      setHeight: (h) => { ta.style.height = h; },
      destroy: () => { el.innerHTML = ""; },
      focus: () => ta.focus(),
    };
  }

  function buildEditor(initialMd) {
    if (state.editor) {
      try { state.editor.destroy(); } catch (e) {}
      state.editor = null;
      $("#editor").innerHTML = "";
    }
    if (!(window.toastui && window.toastui.Editor)) {
      state.editor = fallbackEditor($("#editor"), initialMd);
      state.editor.setHeight(editorHeight());
      return;
    }
    const compact = window.matchMedia("(max-width: 760px)").matches;
    const opts = {
      el: $("#editor"),
      height: editorHeight(),
      initialEditType: "wysiwyg",
      previewStyle: "tab",
      usageStatistics: false,
      placeholder: "The story of this hour…",
      initialValue: initialMd || "",
      toolbarItems: compact
        ? [["heading", "bold", "italic"], ["quote"], ["ul", "ol"]]
        : [["heading", "bold", "italic", "strike"], ["hr", "quote"], ["ul", "ol"], ["link"]],
      hooks: {
        addImageBlobHook: (blob, callback) => {
          uploadAsset(blob, CONFIG.photosDir)
            .then((url) => { if (url) callback(url, blob.name || "image"); })
            .catch((e) => toast(e.message, true));
        },
      },
    };
    if (currentTheme() === "dark") opts.theme = "dark";
    state.editor = new window.toastui.Editor(opts);
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    const btn = $("#theme-toggle");
    if (btn) {
      btn.textContent = t === "light" ? "☾" : "☀";
      btn.title = t === "light" ? "Switch to dark" : "Switch to light";
    }
    if (state.editor && window.toastui) {
      let md = "";
      try { md = state.editor.getMarkdown(); } catch (e) {}
      buildEditor(md);
    }
  }

  /* ---------------- flow fields ---------------- */
  const FLOW_FIELDS = ["#f-title", "#f-line"];

  function growField(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function syncFieldHeights() {
    FLOW_FIELDS.forEach((sel) => { const el = $(sel); if (el) growField(el); });
  }

  function wireFlowFields() {
    FLOW_FIELDS.forEach((sel, i) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener("input", () => growField(el));
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const next = FLOW_FIELDS[i + 1] && $(FLOW_FIELDS[i + 1]);
        if (next) next.focus();
        else if (state.editor && state.editor.focus) { try { state.editor.focus(); } catch (err) {} }
      });
    });
  }

  /* ---------------- boot ---------------- */
  async function start() {
    try {
      const user = await getUser();
      $("#user-name").textContent = user.name || user.login;
      $("#user-avatar").src = user.avatar_url || "";
    } catch (e) {
      loginError(e.message);
      logout();
      return;
    }

    $("#login").hidden = true;
    $("#app").hidden = false;

    try { await loadChapters(); } catch (e) { toast(e.message, true); }
    if (!state.editor) buildEditor("");
    resetForm();
    if (restoreLocalDraft()) toast("Unsaved writing restored.");
    if (!state.autosaveTimer) state.autosaveTimer = setInterval(autosaveTick, 2500);
    switchView("write");
  }

  function wire() {
    wireFlowFields();
    $("#login-btn").addEventListener("click", login);
    $("#logout").addEventListener("click", logout);
    $("#new-btn").addEventListener("click", newChapter);
    $("#list-new").addEventListener("click", newChapter);
    document.querySelectorAll(".nav-item").forEach((b) =>
      b.addEventListener("click", () => switchView(b.dataset.view))
    );
    let rsTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(resizeEditor, 150);
    });
    $("#publish-btn").addEventListener("click", publishChapter);
    $("#delete-btn").addEventListener("click", deleteChapter);
    $("#order-save").addEventListener("click", saveOrder);
    $("#photo-btn").addEventListener("click", () => $("#photo-file").click());
    $("#photo-file").addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length) addPhotos([...e.target.files]);
      e.target.value = "";
    });
    $("#track-add").addEventListener("click", () => $("#track-file").click());
    $("#track-file").addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) addUploadTrack(e.target.files[0]);
      e.target.value = "";
    });
    $("#track-synth").addEventListener("click", addSynthTrack);
    $("#track-save").addEventListener("click", saveTracks);
    $("#site-save").addEventListener("click", saveSite);
    $("#theme-toggle").addEventListener("click", () =>
      applyTheme(currentTheme() === "light" ? "dark" : "light")
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire();
    applyTheme(currentTheme());
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) { state.token = saved; start(); }
  });
})();
