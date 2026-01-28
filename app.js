/**
 * =========================================================
 * Ghibli Films Inspector — API REST (Vanilla ES6+)
 * Enunciado:
 * - Botones para listar:
 *   1) títulos + director (consola)
 *   2) título + año (consola)
 *   3) título + descripción (consola)
 *   4) id de cada película (consola)
 * - Adaptar: ir a buscar la lista solo la primera vez; luego local (cache).
 *
 * Extras portafolio:
 * - UI “filete” + toasts + loader + reset vista / reset total
 * - Accesible + mensajes claros
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  /* -------------------------------------------------------
     Helpers DOM
  -------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);

  const els = {
    statusPill: $("#statusPill"),
    sourcePill: $("#sourcePill"),
    countPill: $("#countPill"),
    timePill: $("#timePill"),

    loader: $("#loader"),
    loaderText: $("#loaderText"),
    meterBar: $("#meterBar"),

    viewTitle: $("#viewTitle"),
    viewDesc: $("#viewDesc"),
    cards: $("#cards"),
    errorBox: $("#errorBox"),
    errorMsg: $("#errorMsg"),
    btnRetry: $("#btnRetry"),

    btnResetView: $("#btnResetView"),
    btnResetAll: $("#btnResetAll"),
    btnForceReload: $("#btnForceReload"),
  };

  /* -------------------------------------------------------
     Estado mínimo (cache en memoria)
  -------------------------------------------------------- */
  const state = {
    films: null, // array cacheado (null hasta primer fetch)
    fetchedAt: null, // Date de la primera carga
    lastView: null, // 'director' | 'year' | 'description' | 'id'
    lastSource: null, // 'API' | 'CACHE'
    isLoading: false,
    inFlightPromise: null, // evita doble fetch si hacen spam click
  };

  const API_URL = "https://ghibliapi.vercel.app/films/";

  /* -------------------------------------------------------
     Toast bonito (sin librerías)
  -------------------------------------------------------- */
  function toast({
    title = "Aviso",
    message = "",
    type = "info",
    timeout = 2600,
  }) {
    const wrap = document.getElementById("toasts");
    if (!wrap) return;

    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.setAttribute("role", "status");

    el.innerHTML = `
      <div class="toast__row">
        <div>
          <p class="toast__title">${escapeHTML(title)}</p>
          <p class="toast__msg">${escapeHTML(message)}</p>
        </div>
        <button class="toast__btn" type="button" aria-label="Cerrar alerta">Cerrar</button>
      </div>
    `;

    const close = () => {
      el.style.animation = "toastOut .16s ease forwards";
      window.setTimeout(() => el.remove(), 160);
    };

    el.querySelector(".toast__btn").addEventListener("click", close);
    wrap.appendChild(el);
    window.setTimeout(close, timeout);
  }

  /* -------------------------------------------------------
     Seguridad básica: evitar inyectar HTML en strings dinámicos
  -------------------------------------------------------- */
  function escapeHTML(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* -------------------------------------------------------
     HUD / Status
  -------------------------------------------------------- */
  function setStatus(text) {
    els.statusPill.textContent = text;
  }

  function fmtTime(date) {
    if (!date) return "—";
    return date.toLocaleTimeString("es-CL", { hour12: false });
  }

  function updateHud() {
    els.sourcePill.textContent = `Fuente: ${state.lastSource ?? "—"}`;
    els.countPill.textContent = `Películas: ${state.films ? state.films.length : "—"}`;
    els.timePill.textContent = `Cargado: ${fmtTime(state.fetchedAt)}`;
  }

  /* -------------------------------------------------------
     Loader visible (con contador de segundos)
  -------------------------------------------------------- */
  let loaderTick = null;
  let loaderStart = 0;

  function showLoader(label = "Cargando… consultando API") {
    state.isLoading = true;
    els.loader.hidden = false;
    els.loaderText.textContent = label;

    loaderStart = performance.now();
    // barra con animación CSS: reiniciamos para que se vea “viva”
    els.meterBar.style.animation = "none";
    // forzar reflow para reiniciar la animación
    void els.meterBar.offsetWidth;
    els.meterBar.style.animation = "";

    // contador visible (actualiza texto)
    if (loaderTick) window.clearInterval(loaderTick);
    loaderTick = window.setInterval(() => {
      const s = Math.floor((performance.now() - loaderStart) / 1000);
      els.loaderText.textContent = `${label} · ${s}s`;
    }, 250);
  }

  function hideLoader() {
    state.isLoading = false;
    els.loader.hidden = true;

    if (loaderTick) window.clearInterval(loaderTick);
    loaderTick = null;
  }

  /* -------------------------------------------------------
     Error state
  -------------------------------------------------------- */
  function showError(message) {
    els.errorMsg.textContent = message;
    els.errorBox.hidden = false;
  }

  function hideError() {
    els.errorBox.hidden = true;
    els.errorMsg.textContent = "—";
  }

  /* -------------------------------------------------------
     Cache: fetch SOLO la primera vez (y luego local)
  -------------------------------------------------------- */
  async function getFilmsOnce({ force = false } = {}) {
    // Si no forzamos y ya existe cache, devolvemos cache al tiro
    if (!force && Array.isArray(state.films)) {
      state.lastSource = "CACHE";
      updateHud();
      return state.films;
    }

    // Evita múltiples fetch si el usuario presiona varios botones rápido
    if (!force && state.inFlightPromise) {
      state.lastSource = "API";
      updateHud();
      return state.inFlightPromise;
    }

    hideError();
    showLoader("Cargando… consultando API");
    setStatus("Cargando…");

    const p = (async () => {
      const res = await fetch(API_URL, { method: "GET" });

      // Validación básica de HTTP
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: no se pudo obtener la lista.`);
      }

      const data = await res.json();

      // Validación básica de tipo
      if (!Array.isArray(data)) {
        throw new Error(
          "Respuesta inesperada: no llegó un arreglo de películas.",
        );
      }

      // Guardamos cache
      state.films = data;
      state.fetchedAt = new Date();
      state.lastSource = "API";
      updateHud();

      return data;
    })();

    state.inFlightPromise = p;

    try {
      const films = await p;
      return films;
    } finally {
      // Limpieza (siempre)
      state.inFlightPromise = null;
      hideLoader();
      setStatus("Listo");
    }
  }

  /* -------------------------------------------------------
     Consola: cumplir el enunciado “listar por consola”
  -------------------------------------------------------- */
  function logToConsole(view, films) {
    const label = `[${state.lastSource ?? "—"}] ${view.toUpperCase()} (${films.length} films)`;

    // Un log “bonito”
    console.groupCollapsed(label);

    if (view === "director") {
      console.table(
        films.map((f) => ({ title: f.title, director: f.director })),
      );
    }
    if (view === "year") {
      console.table(
        films.map((f) => ({ title: f.title, year: f.release_date })),
      );
    }
    if (view === "description") {
      console.table(
        films.map((f) => ({ title: f.title, description: f.description })),
      );
    }
    if (view === "id") {
      console.table(films.map((f) => ({ id: f.id, title: f.title })));
    }

    console.groupEnd();
  }

  /* -------------------------------------------------------
     Render: tarjetas según vista
  -------------------------------------------------------- */
  function setViewHeader(view) {
    const map = {
      director: {
        title: "Títulos + Director",
        desc: "Lista todos los títulos y su respectivo director (y también se imprime en consola).",
      },
      year: {
        title: "Título + Año",
        desc: "Lista título y año de estreno (release_date).",
      },
      description: {
        title: "Título + Descripción",
        desc: "Lista título y descripción. Incluye “ver más” para no saturar la UI.",
      },
      id: {
        title: "IDs",
        desc: "Lista el id de cada película (con título pequeño para contexto).",
      },
    };

    els.viewTitle.textContent = map[view]?.title ?? "Salida";
    els.viewDesc.textContent = map[view]?.desc ?? "—";
  }

  function clearCards() {
    els.cards.innerHTML = `
      <article class="empty">
        <p class="empty__title">Sin resultados</p>
        <p class="empty__desc">Presiona un botón para listar información.</p>
      </article>
    `;
  }

  function render(view, films) {
    setViewHeader(view);

    // Render base (una sola pasada)
    const html = films
      .map((f, i) => {
        // stagger: delay por índice (solo inline style, simple y efectivo)
        const delay = Math.min(240, i * 14);

        if (view === "director") {
          return `
          <article class="item" style="animation-delay:${delay}ms">
            <h3 class="item__title">${escapeHTML(f.title)}</h3>
            <p class="item__meta"><strong>Director:</strong> ${escapeHTML(f.director)}</p>
            <p class="item__mono">Año: ${escapeHTML(f.release_date)} · ID: ${escapeHTML(f.id)}</p>
          </article>
        `;
        }

        if (view === "year") {
          return `
          <article class="item" style="animation-delay:${delay}ms">
            <h3 class="item__title">${escapeHTML(f.title)}</h3>
            <p class="item__meta"><strong>Año:</strong> ${escapeHTML(f.release_date)}</p>
            <p class="item__mono">Director: ${escapeHTML(f.director)} · ID: ${escapeHTML(f.id)}</p>
          </article>
        `;
        }

        if (view === "description") {
          const short = (f.description ?? "").slice(0, 180);
          const hasMore = (f.description ?? "").length > 180;

          return `
          <article class="item" style="animation-delay:${delay}ms" data-desc-card="1">
            <h3 class="item__title">${escapeHTML(f.title)}</h3>
            <p class="item__meta"><strong>Descripción:</strong></p>

            <!-- Texto corto por defecto -->
            <p class="item__desc" data-desc="short">${escapeHTML(short)}${hasMore ? "…" : ""}</p>

            <!-- Texto completo oculto (se alterna con botón) -->
            <p class="item__desc" data-desc="full" hidden>${escapeHTML(f.description ?? "")}</p>

            ${
              hasMore
                ? `
              <button class="item__more" type="button" data-toggle-desc="1">
                Ver más <span aria-hidden="true">↗</span>
              </button>
            `
                : ""
            }

            <p class="item__mono">Director: ${escapeHTML(f.director)} · Año: ${escapeHTML(f.release_date)}</p>
          </article>
        `;
        }

        // view === "id"
        return `
        <article class="item" style="animation-delay:${delay}ms">
          <h3 class="item__title">ID</h3>
          <p class="item__mono">${escapeHTML(f.id)}</p>
          <p class="item__meta"><strong>Título:</strong> ${escapeHTML(f.title)}</p>
        </article>
      `;
      })
      .join("");

    els.cards.innerHTML =
      html ||
      `
      <article class="empty">
        <p class="empty__title">Sin resultados</p>
        <p class="empty__desc">No llegaron películas desde la API.</p>
      </article>
    `;
  }

  /* -------------------------------------------------------
     Interacciones: toggle “ver más / ver menos” (delegación)
  -------------------------------------------------------- */
  els.cards.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-desc]");
    if (!btn) return;

    const card = btn.closest("[data-desc-card]");
    if (!card) return;

    const shortEl = card.querySelector('[data-desc="short"]');
    const fullEl = card.querySelector('[data-desc="full"]');

    const isFullVisible = !fullEl.hidden;

    // Alterna
    fullEl.hidden = isFullVisible;
    shortEl.hidden = !isFullVisible;

    btn.innerHTML = isFullVisible
      ? `Ver más <span aria-hidden="true">↗</span>`
      : `Ver menos <span aria-hidden="true">↙</span>`;
  });

  /* -------------------------------------------------------
     Acción principal: click de botones (vistas)
  -------------------------------------------------------- */
  async function runView(view) {
    state.lastView = view;

    try {
      const films = await getFilmsOnce({ force: false });

      // Consola (requisito)
      logToConsole(view, films);

      // UI
      render(view, films);

      // Feedback
      toast({
        title: "Vista lista",
        message: `Mostrando: ${els.viewTitle.textContent} · Fuente: ${state.lastSource}`,
        type: "ok",
      });

      setStatus(`Listo · ${els.viewTitle.textContent}`);
    } catch (err) {
      console.error(err);
      showError(err.message || "Error inesperado.");
      clearCards();

      toast({
        title: "Error",
        message: "No se pudo obtener la lista. Reintenta.",
        type: "bad",
        timeout: 3200,
      });

      setStatus("Error");
    } finally {
      updateHud();
    }
  }

  /* -------------------------------------------------------
     Botones de vista (data-view)
  -------------------------------------------------------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;

    const view = btn.getAttribute("data-view");

    // Evita lanzar otra vista si estamos cargando (fetch)
    if (state.isLoading) {
      toast({
        title: "Espera",
        message: "Aún estoy cargando la lista…",
        type: "info",
      });
      return;
    }

    runView(view);
  });

  /* -------------------------------------------------------
     Reintentar si falló
  -------------------------------------------------------- */
  els.btnRetry.addEventListener("click", () => {
    hideError();
    if (state.lastView) runView(state.lastView);
    else
      toast({
        title: "Tip",
        message: "Elige una vista para comenzar.",
        type: "info",
      });
  });

  /* -------------------------------------------------------
     Reset de vista (solo UI)
  -------------------------------------------------------- */
  function resetView() {
    hideError();
    state.lastView = null;
    els.viewTitle.textContent = "Salida";
    els.viewDesc.textContent = "Presiona un botón para listar resultados.";
    els.cards.innerHTML = `
      <article class="empty">
        <p class="empty__title">Sin datos todavía</p>
        <p class="empty__desc">Elige una vista para consultar la API (primera vez) o usar cache (después).</p>
      </article>
    `;
    setStatus("Listo");
  }

  /* -------------------------------------------------------
     Reset total (UI + cache)
  -------------------------------------------------------- */
  function resetAll() {
    resetView();
    state.films = null;
    state.fetchedAt = null;
    state.lastSource = null;
    state.inFlightPromise = null;
    updateHud();
  }

  els.btnResetView.addEventListener("click", () => {
    resetView();
    toast({ title: "Reiniciado", message: "Vista limpiada.", type: "info" });
  });

  els.btnResetAll.addEventListener("click", () => {
    resetAll();
    toast({
      title: "Todo reiniciado",
      message: "Cache limpiado (volverá a consultar API).",
      type: "info",
    });
  });

  /* -------------------------------------------------------
     Forzar recarga (opcional para pruebas)
  -------------------------------------------------------- */
  els.btnForceReload.addEventListener("click", async () => {
    if (state.isLoading) return;

    try {
      const films = await getFilmsOnce({ force: true });
      toast({
        title: "Recargado",
        message: `API consultada nuevamente (${films.length} films).`,
        type: "ok",
      });
      setStatus("Listo · Recargado");
      // Si había una vista activa, re-render
      if (state.lastView) {
        logToConsole(state.lastView, films);
        render(state.lastView, films);
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Error inesperado.");
      toast({ title: "Error", message: "No se pudo recargar.", type: "bad" });
      setStatus("Error");
    } finally {
      updateHud();
    }
  });

  /* -------------------------------------------------------
     Init
  -------------------------------------------------------- */
  resetView();
  updateHud();

  // Mini mensaje para consola
  console.log(
    "Ghibli Films Inspector listo. Tip: usa los botones y revisa console.table().",
  );
});
