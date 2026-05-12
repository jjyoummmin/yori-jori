(function () {
  "use strict";

  const LS_ENTRIES = "yj_entries_v1";
  const LS_ONBOARD = "yj_onboarding_v1";
  const LS_RECIPE_SHEET = "yj_recipe_sheet_exp";

  /** @type {{ id: string, date: string, title: string, memo: string, photos: string[] }[]} */
  let entries = [];

  const state = {
    view: "calendar",
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    /** @type {string | null} YYYY-MM-DD */
    selectedDate: null,
    /** @type {string | null} */
    editingId: null,
    /** @type {string[]} */
    draftPhotos: [],
    draftTitle: "",
    draftMemo: "",
    /** 전체 요리 접이식 패널 열림 */
    recipeSheetExpanded: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function loadEntries() {
    try {
      const raw = localStorage.getItem(LS_ENTRIES);
      entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) entries = [];
      entries = entries.map((e) => {
        const photos = Array.isArray(e.photos)
          ? e.photos.filter(Boolean)
          : e.photo
            ? [e.photo]
            : [];
        const { photo: _legacyPhoto, ...rest } = e;
        return { ...rest, photos };
      });
    } catch {
      entries = [];
    }
  }

  function saveEntries() {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toDateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function entriesForDate(key) {
    return entries.filter((e) => e.date === key).sort((a, b) => a.id.localeCompare(b.id));
  }

  function firstPhotoForEntry(entry) {
    return entry.photos?.[0] ?? null;
  }

  function firstPhotoForDate(key) {
    const list = entriesForDate(key);
    for (const e of list) {
      const photo = firstPhotoForEntry(e);
      if (photo) return photo;
    }
    return null;
  }

  function formatDayTitle(key) {
    const d = parseKey(key);
    const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`;
  }

  /** YYYY-MM-DD → yyyy.mm.dd */
  function formatDateDots(key) {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "—";
    const [y, mo, d] = key.split("-");
    return `${y}.${mo}.${d}`;
  }

  /** 요리 이름(trim) 기준 유니크, 최신 기록일 기준 내림차순 정렬용 */
  function aggregateUniqueDishes() {
    /** @type {Map<string, { displayTitle: string, lastDate: string }>} */
    const map = new Map();
    const chronological = [...entries].sort((a, b) => {
      const c = a.date.localeCompare(b.date);
      return c !== 0 ? c : a.id.localeCompare(b.id);
    });
    for (const e of chronological) {
      const raw = (e.title || "").trim();
      const ukey = raw || "__untitled__";
      const displayTitle = raw || "제목 없음";
      let agg = map.get(ukey);
      if (!agg) {
        agg = { displayTitle, lastDate: e.date };
        map.set(ukey, agg);
      }
      if (e.date >= agg.lastDate) agg.lastDate = e.date;
    }
    return [...map.values()].sort((a, b) => {
      const c = b.lastDate.localeCompare(a.lastDate);
      return c !== 0 ? c : a.displayTitle.localeCompare(b.displayTitle, "ko");
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 360;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        const c = document.createElement("canvas");
        c.width = Math.round(w);
        c.height = Math.round(h);
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        try {
          resolve(c.toDataURL("image/jpeg", 0.72));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      img.src = url;
    });
  }

  function showView(name) {
    state.view = name;
    ["view-onboarding", "view-calendar", "view-day", "view-form"].forEach((id) => {
      const el = document.getElementById(id);
      const on = id === `view-${name}`;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    const fab = $("#fab");
    fab.classList.toggle("is-visible", name === "calendar");
    if (name === "onboarding") fab.classList.remove("is-visible");
  }

  function showToast() {
    const toast = $("#toast");
    const strip = toast.querySelector(".toast-strip");
    const neu = strip.cloneNode(true);
    strip.replaceWith(neu);
    toast.classList.add("is-on");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-on"), 2400);
  }

  function renderOnboarding() {
    const root = $("#view-onboarding");
    root.innerHTML = `
      <h1 class="onb-title">요리조리에 온 걸 환영해요</h1>
      <p class="onb-body">날짜를 탭해 그날 먹은 요리를 사진과 함께 남겨 보세요. 첫 기록을 저장하면 캘린더에 바로 보여요.</p>
      <div class="sprite-window" aria-hidden="true"><div class="sprite-strip--onboard"></div></div>
      <p class="onb-note">요리하는 동안 짧게 움직이는 쉐프예요.</p>
      <button type="button" class="btn-primary" data-action="finish-onboarding" style="margin-top:24px">시작하기</button>
    `;
  }

  function renderCalendar() {
    const y = state.year;
    const m = state.month;
    const first = new Date(y, m, 1);
    const pad = first.getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < pad; i++) cells.push({ type: "pad" });
    for (let d = 1; d <= lastDate; d++) {
      const key = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      const list = entriesForDate(key);
      cells.push({ type: "day", d: key, count: list.length, photo: firstPhotoForDate(key) });
    }
    while (cells.length % 7 !== 0) cells.push({ type: "pad" });

    const grid = cells
      .map((c) => {
        if (c.type === "pad") return `<div class="cell-pad" aria-hidden="true"></div>`;
        if (c.count === 0) {
          return `<button type="button" class="cell-day cell-day--empty" data-action="open-day" data-date="${c.d}"><span class="cell-day-num">${parseKey(c.d).getDate()}</span></button>`;
        }
        const badge = c.count > 1 ? `<span class="cell-badge">${c.count}</span>` : "";
        const src = c.photo || "assets/reference-mood.png";
        return `<button type="button" class="cell-day" data-action="open-day" data-date="${c.d}">
          <img class="cell-thumb" alt="" src="${src}" loading="lazy" />${badge}
        </button>`;
      })
      .join("");

    const wk = ["일", "월", "화", "수", "목", "금", "토"]
      .map((d) => `<div>${d}</div>`)
      .join("");

    const uniq = aggregateUniqueDishes();
    const exp = state.recipeSheetExpanded;
    const sheetRows =
      uniq.length === 0
        ? `<p class="recipe-sheet-empty">아직 기록된 요리가 없어요.</p>`
        : `<ul class="recipe-sheet-list">${uniq
            .map(
              (u) =>
                `<li class="recipe-sheet-item"><span class="recipe-sheet-item-text">${escapeHtml(u.displayTitle)}</span></li>`,
            )
            .join("")}</ul>`;

    $("#view-calendar").innerHTML = `
      <header class="cal-header">
        <h1 class="cal-title">캘린더</h1>
        <nav class="month-nav" aria-label="월 이동">
          <button type="button" data-action="prev-month" aria-label="이전 달">&lt;</button>
          <span class="month-label">${y}.${m + 1}</span>
          <button type="button" data-action="next-month" aria-label="다음 달">&gt;</button>
        </nav>
      </header>
      <div class="week-row">${wk}</div>
      <div class="cal-body">
        <div class="cal-grid">${grid}</div>
        <section class="recipe-sheet ${exp ? "is-expanded" : ""}">
          <button type="button" class="recipe-sheet-toggle" data-action="toggle-recipe-sheet" aria-expanded="${exp}">
            <span class="recipe-sheet-toggle-accent" aria-hidden="true"></span>
            <span class="recipe-sheet-toggle-main">
              <span class="recipe-sheet-toggle-title">전체 요리</span>
              <span class="recipe-sheet-toggle-hint">같은 이름은 한 번만 · 최신순</span>
            </span>
            <span class="recipe-sheet-toggle-trail">
              <span class="recipe-sheet-count" aria-label="가지 수">${uniq.length}</span>
              <span class="recipe-sheet-chevron" aria-hidden="true">${exp ? "▲" : "▼"}</span>
            </span>
          </button>
          <div class="recipe-sheet-panel">${sheetRows}</div>
        </section>
      </div>
    `;
  }

  function renderDay() {
    const key = state.selectedDate;
    if (!key) {
      showView("calendar");
      renderCalendar();
      return;
    }
    const list = entriesForDate(key);
    const rows =
      list.length === 0
        ? `<p class="empty-day">아직 기록이 없어요.<br />우측 상단 <b>추가</b>를 눌러 보세요.</p>`
        : list
            .map((e) => {
              const cover = firstPhotoForEntry(e);
              const thumb = cover
                ? `<img class="dish-thumb" alt="" src="${cover}" />`
                : `<div class="dish-thumb" style="background:linear-gradient(135deg,#ffb347,#e85d4c)"></div>`;
              return `<button type="button" class="dish-row" data-action="edit-entry" data-id="${e.id}">
                ${thumb}
                <div class="dish-text"><div class="dish-name">${escapeHtml(e.title || "제목 없음")}</div><div class="dish-note">${escapeHtml(e.memo || "—")}</div></div>
              </button>`;
            })
            .join("");

    $("#view-day").innerHTML = `
      <header class="top-bar">
        <button type="button" class="link-btn link-muted" data-action="back-cal">&lt; 뒤로</button>
        <span class="day-title">${formatDayTitle(key)}</span>
        <button type="button" class="link-btn link-primary" data-action="add-entry">추가</button>
      </header>
      <div class="dish-list">${rows}</div>
    `;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function openForm(dateKey, entryId) {
    state.selectedDate = dateKey;
    state.editingId = entryId;
    if (entryId) {
      const e = entries.find((x) => x.id === entryId);
      state.draftPhotos = [...(e?.photos ?? [])];
      state.draftTitle = e?.title ?? "";
      state.draftMemo = e?.memo ?? "";
    } else {
      state.draftPhotos = [];
      state.draftTitle = "";
      state.draftMemo = "";
    }
    renderForm();
    showView("form");
  }

  function renderPhotoGrid() {
    const photos = state.draftPhotos;
    const tiles = photos
      .map(
        (src, index) => `<div class="photo-tile">
          <img alt="첨부 사진 ${index + 1}" src="${src}" />
          <button type="button" class="photo-remove" data-action="remove-photo" data-index="${index}" aria-label="사진 ${index + 1} 삭제">×</button>
        </div>`,
      )
      .join("");

    if (photos.length === 0) {
      return `<div class="photo-grid photo-grid--empty">
        <button type="button" class="photo-add photo-add--hero" data-action="pick-photo">
          <span class="slot-hint">탭하여 요리 사진 추가</span>
          <span class="slot-sub">여러 장 선택할 수 있어요 · 캘린더에는 첫 사진이 대표로 표시됩니다</span>
        </button>
      </div>`;
    }

    return `<div class="photo-grid">
      ${tiles}
      <button type="button" class="photo-add" data-action="pick-photo" aria-label="사진 추가">
        <span class="photo-add-icon" aria-hidden="true">+</span>
        <span class="photo-add-label">사진 추가</span>
      </button>
    </div>
    <p class="photo-grid-note">캘린더에는 첫 사진이 대표로 표시됩니다</p>`;
  }

  function renderForm() {
    const key = state.selectedDate;
    const dateDots = key ? formatDateDots(key) : "—";
    const dateWeek = key ? formatDayTitle(key) : "";
    $("#view-form").innerHTML = `
      <header class="top-bar top-bar--form">
        <button type="button" class="link-btn link-muted" data-action="cancel-form">취소</button>
        <div class="top-bar-center">
          <div class="form-screen-title">요리 기록</div>
          <div class="form-date-dots">${escapeHtml(dateDots)}</div>
          ${dateWeek ? `<div class="form-date-week">${escapeHtml(dateWeek)}</div>` : ""}
        </div>
        <span class="top-bar-spacer" aria-hidden="true"></span>
      </header>
      <div class="form-stack">
        ${renderPhotoGrid()}
        <div class="field">
          <label for="f-title">요리 이름</label>
          <input id="f-title" type="text" autocomplete="off" placeholder="예: 된장찌개" value="${escapeHtml(state.draftTitle)}" />
        </div>
        <div class="field">
          <label for="f-memo">메모</label>
          <textarea id="f-memo" placeholder="재료, 간, 팁…">${escapeHtml(state.draftMemo)}</textarea>
        </div>
        <div class="spacer"></div>
        ${state.editingId ? `<button type="button" class="btn-ghost" data-action="delete-entry">이 기록 삭제</button>` : ""}
        <button type="button" class="btn-primary" data-action="save-entry">저장</button>
      </div>
    `;
  }

  function deleteEntry() {
    if (!state.editingId) return;
    entries = entries.filter((e) => e.id !== state.editingId);
    saveEntries();
    showView("day");
    renderDay();
  }

  function saveEntry() {
    const title = ($("#f-title")?.value || "").trim();
    const memo = ($("#f-memo")?.value || "").trim();
    const key = state.selectedDate;
    if (!key) return;
    if (!state.editingId) {
      const id = crypto.randomUUID();
      entries.push({
        id,
        date: key,
        title,
        memo,
        photos: [...state.draftPhotos],
      });
    } else {
      const e = entries.find((x) => x.id === state.editingId);
      if (e) {
        e.title = title;
        e.memo = memo;
        e.photos = [...state.draftPhotos];
      }
    }
    saveEntries();
    showView("day");
    renderDay();
    showToast();
  }

  function onDelegatedClick(e) {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const act = t.dataset.action;

    if (act === "finish-onboarding") {
      localStorage.setItem(LS_ONBOARD, "1");
      showView("calendar");
      renderCalendar();
      return;
    }
    if (act === "toggle-recipe-sheet") {
      state.recipeSheetExpanded = !state.recipeSheetExpanded;
      localStorage.setItem(LS_RECIPE_SHEET, state.recipeSheetExpanded ? "1" : "0");
      renderCalendar();
      return;
    }
    if (act === "prev-month") {
      if (state.month === 0) {
        state.month = 11;
        state.year--;
      } else state.month--;
      renderCalendar();
      return;
    }
    if (act === "next-month") {
      if (state.month === 11) {
        state.month = 0;
        state.year++;
      } else state.month++;
      renderCalendar();
      return;
    }
    if (act === "open-day") {
      state.selectedDate = t.dataset.date;
      showView("day");
      renderDay();
      return;
    }
    if (act === "back-cal") {
      showView("calendar");
      renderCalendar();
      return;
    }
    if (act === "add-entry") {
      openForm(state.selectedDate, null);
      return;
    }
    if (act === "edit-entry") {
      openForm(state.selectedDate, t.dataset.id);
      return;
    }
    if (act === "cancel-form") {
      showView("day");
      renderDay();
      return;
    }
    if (act === "pick-photo") {
      $("#file-photo").click();
      return;
    }
    if (act === "remove-photo") {
      const index = Number(t.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= state.draftPhotos.length) return;
      state.draftPhotos.splice(index, 1);
      renderForm();
      return;
    }
    if (act === "save-entry") {
      saveEntry();
      return;
    }
    if (act === "delete-entry") {
      if (confirm("이 기록을 삭제할까요?")) deleteEntry();
      return;
    }
  }

  function onFabClick() {
    const today = toDateKey(new Date());
    state.selectedDate = today;
    state.year = new Date().getFullYear();
    state.month = new Date().getMonth();
    openForm(today, null);
  }

  function onFileChange(ev) {
    const files = [...(ev.target.files || [])].filter((f) => f.type.startsWith("image/"));
    ev.target.value = "";
    if (files.length === 0) return;
    Promise.all(files.map((f) => compressImage(f).catch(() => null)))
      .then((results) => {
        const added = results.filter(Boolean);
        if (added.length === 0) return;
        state.draftPhotos.push(...added);
        renderForm();
      });
  }

  function init() {
    loadEntries();
    state.recipeSheetExpanded = localStorage.getItem(LS_RECIPE_SHEET) === "1";
    $("#app").addEventListener("click", onDelegatedClick);

    $("#fab").addEventListener("click", onFabClick);
    $("#file-photo").addEventListener("change", onFileChange);

    if (localStorage.getItem(LS_ONBOARD) !== "1") {
      renderOnboarding();
      showView("onboarding");
    } else {
      renderCalendar();
      showView("calendar");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
