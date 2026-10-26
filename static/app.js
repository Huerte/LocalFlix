/* LocalFlix main application: utilities, routing, home page, browse, movie detail, settings. */
'use strict';
(function () {
  const LF = window.LF = {};
  const $ = LF.$ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = LF.$$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const esc = LF.esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  LF.fmtTime = function (s) {
    s = Math.max(0, Math.round(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };
  LF.api = async function (path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(t || r.status); }
    return r.json();
  };

  /* ---- storage ---- */
  const store = LF.store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
  };

  /* ---- prefs ---- */
  const DEF = { subsOn: true, subLang: '', autoNext: true, playMode: 'auto', volume: 1, muted: false, fit: 'contain', speed: 1, subStyle: { size: 100, color: '#ffffff', bg: 'outline', pos: 8 } };
  const saved = store.get('lf.prefs', {}) || {};
  LF.prefs = Object.assign({}, DEF, saved, { subStyle: Object.assign({}, DEF.subStyle, saved.subStyle || {}) });
  LF.savePrefs = function () { store.set('lf.prefs', LF.prefs); };

  /* ---- progress ---- */
  LF.progress = {
    _all() { return store.get('lf.progress', {}) || {}; },
    get(id) { return this._all()[id]; },
    set(id, t, dur) { const a = this._all(); a[id] = { t, d: dur, ts: Date.now() }; store.set('lf.progress', a); },
    // The movie played most recently (any state), or null.
    last() {
      const a = this._all(); let best = null;
      for (const id in a) if (a[id] && a[id].ts && (!best || a[id].ts > a[best].ts)) best = id;
      return best;
    },
    markWatched(id) { const a = this._all(); if (a[id]) { a[id].watched = true; a[id].t = null; a[id].ts = Date.now(); } else { a[id] = { watched: true, ts: Date.now() }; } store.set('lf.progress', a); },
    // Movies that can be continued, most recently watched first.
    resumable() {
      const a = this._all();
      return Object.keys(a).filter((id) => { const p = a[id]; return p && !p.watched && p.t > 10 && p.d && p.t < p.d - 30; })
        .sort((x, y) => (a[y].ts || 0) - (a[x].ts || 0));
    },
  };
  // TV app: positions saved by the native player (it writes them every few seconds, even when the page never hears
  // about the player closing, and they survive a changed server address). Keep whichever record is newer.
  LF.importNativeProgress = function (all) {
    const a = LF.progress._all(); let changed = false;
    Object.keys(all || {}).forEach((id) => {
      const n = all[id], cur = a[id];
      if (!n || !n.ts || (cur && (cur.ts || 0) >= n.ts)) return;
      a[id] = n.w ? { watched: true, t: null, ts: n.ts } : { t: n.t, d: n.d, ts: n.ts };
      changed = true;
    });
    if (changed) store.set('lf.progress', a);
  };

  /* ---- modal system ---- */
  let modalEl = null;
  let modals = [];
  function openModal(html, opts = {}) {
    closeModal();
    const scrim = document.createElement('div');
    scrim.className = 'scrim'; scrim.setAttribute('role', 'dialog'); scrim.setAttribute('aria-modal', 'true');
    scrim.innerHTML = html;
    $('#modalRoot').appendChild(scrim);
    document.body.classList.add('noscroll');
    modalEl = scrim;
    const close = (silent) => {
      if (modalEl !== scrim) return;
      scrim.remove(); modalEl = null;
      if (!$('#player:not([hidden])')) document.body.classList.remove('noscroll');
      if (!silent && opts.onClose) opts.onClose();
    };
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
    const obj = { el: scrim, close };
    modals.push(obj);
    return obj;
  }
  function closeModal(silent) {
    const had = !!modalEl;
    if (modalEl) { modalEl.remove(); modalEl = null; }
    modals = [];
    if (!$('#player:not([hidden])')) document.body.classList.remove('noscroll');
    // TV: the modal's own button just disappeared, so hand focus back to the card the user came from.
    if (had && LF.app) LF.restoreFocus();
  }
  LF.closeOverlay = function () {
    if (modalEl) { closeModal(); if (LF.fromPage) history.back(); else location.hash = '#/'; }
    else if (LF.player && LF.player.active) { LF.player.close(); }
  };
  LF.toast = function (msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  };

  /* ---- data ---- */
  LF.movies = []; LF.info = null; LF.offline = false;
  // LocalFlix Android TV app: the native wrapper adds "LocalFlixTV" to the user agent and injects window.LocalFlixTV.
  // LF.app is false in every normal browser, so phones and laptops behave exactly as before.
  LF.app = !!window.LocalFlixTV || navigator.userAgent.includes('LocalFlixTV');
  LF.tv = LF.app || /android|googletv|hbbtv|netcast/i.test(navigator.userAgent);
  if (LF.app) document.documentElement.classList.add('lftv');
  const norm = (s) => s.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const sortKey = (s) => s.replace(/^(the|a|an)\s+/i, '').toLowerCase().replace(/(\d+)/g, (m) => m.padStart(6, '0'));
  function prep(list) {
    list.forEach((m) => { m._k = sortKey(m.title); m._tn = norm(m.title); m._tok = norm([m.title, m.year, m.folder].join(' ')).split(/\s+/); });
    return list;
  }

  /* ---- search ---- */
  const norm2 = (s) => norm(s).split(/\s+/).filter(Boolean);
  function score(m, q) {
    const words = norm2(q);
    if (!words.length) return 1;
    const t = m._tn, toks = m._tok;
    let s = 0;
    for (const w of words) {
      if (toks.some((tk) => tk === w)) s += 3;
      else if (toks.some((tk) => tk.startsWith(w))) s += 2;
      else if (t.includes(w)) s += 1;
      else { s -= 5; }
    }
    return s;
  }
  LF.searchMovies = function (q) {
    if (!q) return LF.movies.slice();
    const scored = LF.movies.map((m) => ({ m, s: score(m, q) })).filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  };
  function byId(id) { return LF.movies.find((m) => m.id === id); }

  /* ---- poster image ---- */
  // The TV app asks the server for a small copy (?w=): decoding full-size covers is what makes a TV stutter.
  const posterUrl = LF.posterUrl = (m, w) => `/poster/${m.id}?v=${m.pv}${LF.app ? '&w=' + (w || 360) : ''}`;
  function posterEl(m, cls) {
    const prog = LF.progress.get(m.id);
    const pct = prog && prog.d ? Math.round(prog.t / prog.d * 100) : 0;
    const watched = prog && prog.watched;
    return `<div class="poster ${cls || ''}" data-id="${m.id}"><div class="ph ${m.poster !== 'ready' ? 'shim' : ''}">${m.poster === 'ready' ? `<img data-p="1" alt="" decoding="async" src="${posterUrl(m)}" loading="lazy">` : `<b>${esc(m.title)}</b><small>${m.year || m.ext}</small>`}</div>${m.subs ? '<div class="badges"><span class="badge cc">CC</span></div>' : ''}</div>${pct > 3 && !watched ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}`;
  }
  // IntersectionObserver-based image lazy loader for smooth card rendering
  let _imgObs = null;
  function getImgObs() {
    if (!_imgObs) {
      _imgObs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          _imgObs.unobserve(img);
          if (!img.src) img.src = img.dataset.src;
          if (img.complete) { img.classList.add('ld'); return; }
          img.addEventListener('load', () => img.classList.add('ld'), { once: true });
          img.addEventListener('error', () => img.closest('.ph')?.classList.remove('shim'), { once: true });
        });
      }, { rootMargin: '300px' });
    }
    return _imgObs;
  }
  function settleImages(root) {
    (root || document).querySelectorAll('img[data-p]').forEach((img) => {
      if (img.classList.contains('ld')) return;
      if (img.complete && img.naturalWidth > 0) { img.classList.add('ld'); return; }
      // If src not yet set (data-src pattern), or image not loaded yet
      getImgObs().observe(img);
    });
  }

  /* ---- card ---- */
  function card(m) {
    return `<a class="card" href="#/movie/${m.id}" data-id="${m.id}" aria-label="${esc(m.title)}${m.year ? ' (' + m.year + ')' : ''}" role="article">
      ${posterEl(m)}
      <div class="card-overlay"><div class="card-overlay-play"><svg class="ic"><use href="#i-play"/></svg></div></div>
      <div class="c-t">${esc(m.title)}</div>
      <div class="c-m">${[m.year, m.ext].filter(Boolean).join(' · ')}</div>
    </a>`;
  }

  /* ---- render states ---- */
  function errorState(msg) {
    return `<div class="state"><svg class="ic"><use href="#i-alert"/></svg><h2>Cannot reach server</h2><p>${esc(msg)}</p></div>`;
  }
  function emptyState(msg) {
    return `<div class="state"><svg class="ic"><use href="#i-film"/></svg><h2>No movies found</h2><p>${esc(msg)}</p></div>`;
  }

  /* ---- home ---- */
  function focusedCardId() {
    const a = document.activeElement, c = a && a.closest && a.closest('.card');
    return c ? c.dataset.id : null;
  }
  function renderHome() {
    const main = $('#main');
    const prevId = LF.app && LF._wasPage === 'home' ? focusedCardId() : null;
    const movies = LF.movies;
    if (!movies.length) {
      main.innerHTML = emptyState('Add some video files to your movies folder, then refresh.');
      return;
    }
    const addedSort = movies.slice().sort((a, b) => b.added - a.added);
    const recent30 = addedSort.slice(0, 30);
    // Header: the movie played last (continue / start over). Only when nothing was played yet it shows the newest one.
    const lastM = byId(LF.progress.last());
    const hero = lastM || recent30[0];
    const hp = lastM ? LF.progress.get(hero.id) : null;
    const canResume = !!(hp && !hp.watched && hp.t > 10 && hp.d && hp.t < hp.d - 30);
    const eyebrow = !lastM ? 'Just Added' : canResume ? 'Continue Watching' : 'Watch Again';
    const heroActions = !lastM
      ? `<a class="btn primary" href="#/watch/${hero.id}"><svg class="ic"><use href="#i-play"/></svg>Play</a>
              <a class="btn ghost" href="#/movie/${hero.id}">More info</a>`
      : canResume
        ? `<a class="btn primary" href="#/watch/${hero.id}?t=${Math.floor(hp.t)}"><svg class="ic"><use href="#i-play"/></svg>Resume ${LF.fmtTime(hp.t)}</a>
              <a class="btn" href="#/watch/${hero.id}?t=0">Start over</a>
              <a class="btn ghost" href="#/movie/${hero.id}">More info</a>`
        : `<a class="btn primary" href="#/watch/${hero.id}?t=0"><svg class="ic"><use href="#i-play"/></svg>Play again</a>
              <a class="btn ghost" href="#/movie/${hero.id}">More info</a>`;
    const info = LF.info || {};
    const heroMeta = posters.infoCache ? posters.infoCache[hero.id] : {};
    function rowHtml(title, list, limit = 18) {
      const items = list.slice(0, limit);
      if (!items.length) return '';
      return `<section class="sec" aria-labelledby="r-${title.replace(/\s/g,'')}">
        <div class="sec-h"><h2 id="r-${title.replace(/\s/g,'')}">${esc(title)}</h2></div>
        <div class="row-wrap"><div class="row" id="row-${title.replace(/\s/g,'')}">
          ${items.map(card).join('')}
        </div>
        <button class="row-nav l" type="button" aria-label="Scroll left" onclick="scrollRow(this,-1)"><svg class="ic"><use href="#i-chev"/></svg></button>
        <button class="row-nav r" type="button" aria-label="Scroll right" onclick="scrollRow(this,1)"><svg class="ic"><use href="#i-chev"/></svg></button>
        </div></section>`;
    }
    window.scrollRow = function(btn, dir) {
      const row = btn.parentNode.querySelector('.row');
      if (row) row.scrollBy({ left: dir * 680, behavior: LF.app ? 'auto' : 'smooth' });
    };
    const genres = {};
    movies.forEach((m) => { if (m.genre) (genres[m.genre] = genres[m.genre] || []).push(m); });
    const folders = {};
    movies.forEach((m) => { if (m.folder) (folders[m.folder] = folders[m.folder] || []).push(m); });
    const folderRows = Object.entries(folders).sort((a, b) => b[1].length - a[1].length).slice(0, 3)
      .map(([f, ms]) => rowHtml(f, ms)).join('');
    const heroOv = '';
    const heroPoster = hero.poster === 'ready' && !LF.app ? `url('/poster/${hero.id}?v=${hero.pv}')` : '';   // TV: no blurred backdrop, it is too heavy
    main.innerHTML = `<div class="page">
      <div class="hero">
        ${heroPoster ? `<div class="hero-bg" style="background-image:${heroPoster}"></div>` : ''}
        <div class="hero-shade"></div>
        <div class="hero-in">
          <div class="hero-poster">${posterEl(hero)}</div>
          <div class="hero-txt">
            <div class="eyebrow">${eyebrow}</div>
            <h1>${esc(hero.title)}</h1>
            <div class="meta"><span>${hero.year || ''}</span>${hero.year ? '<span class="dot"></span>' : ''}<span>${hero.ext}</span>${hero.subs ? '<span class="dot"></span><span>Subtitles</span>' : ''}${canResume ? `<span class="dot"></span><span>${LF.fmtTime(hp.t)} of ${LF.fmtTime(hp.d)}</span>` : ''}</div>
            <div class="actions">
              ${heroActions}
            </div>
          </div>
        </div>
      </div>
      ${rowHtml('Continue Watching', LF.progress.resumable().filter((id) => id !== hero.id).map(byId).filter(Boolean), 12)}
      ${rowHtml('Recently Added', recent30, 16)}
      ${rowHtml('All Movies', movies.slice().sort((a, b) => a._k.localeCompare(b._k)), 24)}
      ${folderRows}
    </div>`;
    settleImages(main);
    // TV remote: start with a visible focus ring on the main Play button (only if nothing else holds focus).
    if (LF.app) setTimeout(() => {
      if (modalEl) return;      // never steal focus from an open dialog
      const a = document.activeElement;
      if (!a || a === document.body) {
        const prev = prevId && $('.card[data-id="' + prevId + '"]');
        const p = prev || $('.hero .btn.primary'); if (p) p.focus({ preventScroll: true });
      }
    }, 60);
  }
  const posters = { infoCache: null };

  /* ---- browse ---- */
  let bstate = { q: '', sort: 'name', dir: 'asc', subs: false };
  function applyBrowse(movies) {
    let list = movies.slice();
    if (bstate.q) list = LF.searchMovies(bstate.q);
    if (bstate.subs) list = list.filter((m) => m.subs > 0);
    list.sort((a, b) => {
      let v = 0;
      if (bstate.sort === 'name') v = a._k.localeCompare(b._k);
      else if (bstate.sort === 'year') v = (a.year || 0) - (b.year || 0);
      else if (bstate.sort === 'added') v = a.added - b.added;
      else if (bstate.sort === 'size') v = a.size - b.size;
      return bstate.dir === 'desc' ? -v : v;
    });
    return list;
  }
  function setBrowse(patch) { Object.assign(bstate, patch); if (page === 'browse') renderBrowse(); }
  // Paginated browse: load PAGE_SIZE cards at a time with IntersectionObserver
  const PAGE_SIZE = 24;
  let browseObserver = null;
  let browseFiltered = [];
  let browseLoaded = 0;

  function appendBrowseCards(grid, start, end) {
    const frag = document.createDocumentFragment();
    browseFiltered.slice(start, end).forEach((m) => {
      const div = document.createElement('div');
      div.innerHTML = card(m);
      frag.appendChild(div.firstElementChild);
    });
    grid.appendChild(frag);
    settleImages(grid);
    browseLoaded = end;
  }

  function setupBrowseObserver(grid, sentinel) {
    if (browseObserver) browseObserver.disconnect();
    browseObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (browseLoaded >= browseFiltered.length) { browseObserver.disconnect(); sentinel.hidden = true; return; }
      const next = Math.min(browseLoaded + PAGE_SIZE, browseFiltered.length);
      appendBrowseCards(grid, browseLoaded, next);
      if (browseLoaded >= browseFiltered.length) { browseObserver.disconnect(); sentinel.hidden = true; }
    }, { rootMargin: '300px' });
    browseObserver.observe(sentinel);
  }

  function renderBrowse(q) {
    if (q) { bstate = Object.assign({}, bstate, q); }
    const main = $('#main');
    const prevId = LF.app && LF._wasPage === 'browse' ? focusedCardId() : null;
    const keepId = document.activeElement && /^f(Sort|Dir|Subs)$/.test(document.activeElement.id || '') ? document.activeElement.id : '';
    browseFiltered = applyBrowse(LF.movies);
    browseLoaded = 0;
    const dirIcon = bstate.dir === 'asc' ? '#i-up' : '#i-down';
    // The label follows the chosen sort: A to Z for names, oldest/newest for year and date, smallest/largest for size.
    const dirLabels = { name: ['A to Z', 'Z to A'], added: ['Oldest first', 'Newest first'], year: ['Oldest first', 'Newest first'], size: ['Smallest first', 'Largest first'] };
    const dirLabel = (dirLabels[bstate.sort] || dirLabels.name)[bstate.dir === 'asc' ? 0 : 1];
    const qHtml = bstate.q ? `<span class="qtag">"${esc(bstate.q)}" <button type="button" aria-label="Clear search" onclick="LF._browse({q:''})"><svg class="ic"><use href="#i-close"/></svg></button></span>` : '';
    main.innerHTML = `<div class="page">
      <div class="ph1"><h1>Browse <span class="count">(${browseFiltered.length})</span></h1>${qHtml}</div>
      <div class="toolbar" role="toolbar" aria-label="Filter and sort">
        <span class="tb-lbl">Sort:</span>
        <select id="fSort" class="tb-select" aria-label="Sort by" onchange="LF._browse({sort:this.value})">
          <option value="name"${bstate.sort==='name'?' selected':''}>Name</option>
          <option value="added"${bstate.sort==='added'?' selected':''}>Date Added</option>
          <option value="year"${bstate.sort==='year'?' selected':''}>Year</option>
          <option value="size"${bstate.sort==='size'?' selected':''}>File Size</option>
        </select>
        <button class="tb-btn" id="fDir" type="button" aria-label="Toggle sort order" onclick="LF._browse({dir:LF._bs.dir==='asc'?'desc':'asc'})">
          <svg class="ic"><use href="${dirIcon}"/></svg>${dirLabel}
        </button>
        <div class="tb-sep" aria-hidden="true"></div>
        <button class="tb-btn${bstate.subs ? ' on' : ''}" id="fSubs" type="button" aria-pressed="${bstate.subs}" onclick="LF._browse({subs:!LF._bs.subs})">
          <svg class="ic"><use href="#i-cc"/></svg>Has Subtitles
        </button>
      </div>
      ${browseFiltered.length ? '<div class="grid" id="bGrid"></div><div class="loading-more" id="bSentinel"><div class="spinner"></div><span>Loading more...</span></div>' : '<div class="state" style="margin:40px auto"><svg class="ic"><use href="#i-search"/></svg><h2>No results</h2><p>Try different keywords or remove filters.</p></div>'}
    </div>`;
    if (browseFiltered.length) {
      const grid = $('#bGrid', main);
      const sentinel = $('#bSentinel', main);
      const first = Math.min(PAGE_SIZE, browseFiltered.length);
      appendBrowseCards(grid, 0, first);
      if (browseLoaded >= browseFiltered.length) { sentinel.hidden = true; }
      else setupBrowseObserver(grid, sentinel);
    }
    if (keepId) { const k = $('#' + keepId); if (k) { k.focus({ preventScroll: true }); return; } }
    if (!document.body.classList.contains('pointer')) {
      const first = (prevId && $('#bGrid .card[data-id="' + prevId + '"]', main)) || $('#bGrid .card', main);
      if (first) setTimeout(() => { if (!modalEl && document.activeElement !== sq()) first.focus({ preventScroll: true }); }, 80);
    }
  }
  LF._browse = (p) => { bstate = Object.assign({}, bstate, p); LF._bs = bstate; if (page === 'browse') renderBrowse(); };
  LF._bs = bstate;

  /* ---- page rendering ---- */
  let page = '';
  function renderPage(kind, params) {
    LF._wasPage = page;
    page = kind;
    LF._bs = bstate;
    $$('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === kind));
    if (kind === 'home') renderHome();
    else if (kind === 'browse') {
      const q = (params.q || new URLSearchParams()).get('q') || '';
      const sort = (params.q || new URLSearchParams()).get('sort') || bstate.sort;
      const dir = (params.q || new URLSearchParams()).get('dir') || bstate.dir;
      bstate = { q, sort, dir, subs: bstate.subs };
      LF._bs = bstate;
      renderBrowse();
    }
  }

  /* ---- movie detail ---- */
  function showDetail(mid) {
    const m = byId(mid);
    if (!m) { LF.toast('Movie not found.'); location.replace('#/'); return; }
    const html = `<div class="modal"><button class="m-close" type="button" aria-label="Close" onclick="LF.closeOverlay()"><svg class="ic"><use href="#i-close"/></svg></button>
      <div class="det">
        <div class="poster">${m.poster === 'ready' ? `<img data-p="1" alt="" decoding="async" src="${posterUrl(m, 420)}">` : `<div class="ph"><b>${esc(m.title)}</b></div>`}</div>
        <div>
          <h2>${esc(m.title)}</h2>
          <div class="meta">${m.year ? `<span>${m.year}</span><span class="dot"></span>` : ''}${m.genre ? `<span>${esc(m.genre)}</span><span class="dot"></span>` : ''}<span>${m.ext}</span>${m.dur ? `<span class="dot"></span><span>${LF.fmtTime(m.dur)}</span>` : ''}${m.subs ? `<span class="dot"></span><span>Subtitles</span>` : ''}</div>
          <div class="ov" id="dOv" aria-live="polite">${m.overview ? esc(m.overview) : '<span style="color:var(--muted)">Loading details...</span>'}</div>
          <dl class="facts">
            <dt>Format</dt><dd>${m.ext}</dd>
            <dt>Size</dt><dd>${m.size_str}</dd>
            ${m.folder ? `<dt>Folder</dt><dd>${esc(m.folder)}</dd>` : ''}
          </dl>
          <div class="actions" style="margin-top:20px">
            ${(() => {
              // Saved position: "Resume 12:34" continues at once, "Start over" begins at 0.
              const p = LF.progress.get(m.id);
              if (!(p && !p.watched && p.t > 10 && p.d && p.t < p.d - 30)) return `<a class="btn primary" href="#/watch/${m.id}" id="dPlay"><svg class="ic"><use href="#i-play"/></svg>Play</a>`;
              return `<a class="btn primary" href="#/watch/${m.id}?t=${Math.floor(p.t)}" id="dPlay"><svg class="ic"><use href="#i-play"/></svg>Resume ${LF.fmtTime(p.t)}</a>
                      <a class="btn ghost" href="#/watch/${m.id}?t=0" id="dStart">Start over</a>`;
            })()}
          </div>
          <div id="dSubs" style="margin-top:16px;color:var(--muted);font-size:.93rem">${m.subs ? `${m.subs} subtitle file${m.subs > 1 ? 's' : ''} available` : ''}</div>
        </div>
      </div>
    </div>`;
    const modal = openModal(html, { onClose: () => { if (LF.fromPage) {} } });
    settleImages(modal.el);
    if (LF.app) {
      // Focus Play immediately (a delayed focus left a gap in which the remote could act on the page behind).
      const pb = $('#dPlay', modal.el);
      if (pb) { pb.focus({ preventScroll: true }); modal.el._last = pb; }
      requestAnimationFrame(() => { if (modalEl === modal.el && !modal.el.contains(document.activeElement) && pb) pb.focus({ preventScroll: true }); });
    }
    // Load full details async
    LF.api('/api/movies/' + mid).then((d) => {
      const ovEl = $('#dOv', modal.el);
      if (ovEl) ovEl.textContent = d.overview || '';
      const subEl = $('#dSubs', modal.el);
      if (subEl) {
        const n = (d.tracks || []).length + ((d.probe && d.probe.subs) ? d.probe.subs.length : 0);
        subEl.textContent = n > 0 ? `${n} subtitle track${n > 1 ? 's' : ''} available` : '';
      }
      const factEl = modal.el.querySelector('.facts');
      if (factEl && d.probe && d.probe.video) {
        const v = d.probe.video;
        const extra = document.createElement('dt'); extra.textContent = 'Resolution';
        const extrav = document.createElement('dd'); extrav.textContent = v.h ? `${v.h}p` : `${v.w}x${v.h}`;
        factEl.appendChild(extra); factEl.appendChild(extrav);
      }
    }).catch(() => {});
  }

  /* ---- settings ---- */
  function showSettings() {
    LF.api('/api/settings').then((s) => {
      const html = `<div class="modal sm"><button class="m-close" type="button" aria-label="Close" onclick="LF.closeOverlay()"><svg class="ic"><use href="#i-close"/></svg></button>
        <div class="m-body">
          <h2>Settings</h2>
          ${LF.app ? '<div class="actions" style="margin:0 0 16px"><button class="btn" type="button" id="sChange">Change TV server...</button></div>' : ''}
          ${!s.can_edit ? '<div class="msg">Settings can only be changed from the computer running LocalFlix.</div>' : ''}
          <div id="sMsg"></div>
          <form id="sForm">
            <div class="form-row"><label for="sMovies">Movies folder</label><input class="inp" id="sMovies" type="text" value="${esc(s.movies_dir)}" placeholder="C:\\Users\\You\\Videos\\Movies" ${!s.can_edit ? 'readonly' : ''}><small>Folder that contains your video files.</small></div>
            <div class="form-row"><label for="sSubs">Subtitle folder</label><input class="inp" id="sSubs" type="text" value="${esc(s.subtitle_dir)}" placeholder="C:\\Users\\You\\Videos\\Movies\\subtitle" ${!s.can_edit ? 'readonly' : ''}><small>Folder that contains .srt / .ass / .vtt files. Auto-detected when placed in a "subtitle" subfolder inside your movies folder.</small></div>
            ${s.can_edit ? '<div class="actions" style="margin-top:20px"><button class="btn primary" type="submit" id="sSave">Save &amp; Rescan</button></div>' : ''}
          </form>
        </div>
      </div>`;
      const modal = openModal(html);
      const chg = $('#sChange', modal.el);
      if (chg) { chg.onclick = () => { try { window.LocalFlixTV.changeServer(); } catch { /* bridge missing */ } }; chg.focus({ preventScroll: true }); modal.el._last = chg; }
      const form = $('#sForm', modal.el); if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const msg = $('#sMsg', modal.el);
        const btn = $('#sSave', modal.el); if (btn) btn.textContent = 'Saving…';
        try {
          await LF.api('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movies_dir: $('#sMovies', modal.el).value.trim(), subtitle_dir: $('#sSubs', modal.el).value.trim() }) });
          msg.innerHTML = '<div class="msg ok">Saved. Rescanning library...</div>';
          await LF.load(); if (btn) btn.textContent = 'Save & Rescan';
        } catch (err) {
          msg.innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
          if (btn) btn.textContent = 'Save & Rescan';
        }
      };
    });
  }

  /* ---- search / suggestions ---- */
  let sel = -1, sugg_items = [];
  const sq = () => $('#q'); const sg = () => $('#sugg');
  function closeSugg() { sg().hidden = true; sq().setAttribute('aria-expanded', 'false'); sel = -1; }
  function highlight(title, q) {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean);
    let out = esc(title);
    w.forEach((word) => { out = out.replace(new RegExp(word, 'gi'), '<mark>$&</mark>'); });
    return out;
  }
  function pushRecent(q) {
    if (!q || q.length < 2) return;
    let r = store.get('lf.recent', []) || [];
    r = [q, ...r.filter((x) => x !== q)].slice(0, 8);
    store.set('lf.recent', r);
  }
  function renderSugg() {
    const q = sq().value.trim();
    const box = sg(); let html = ''; sugg_items = [];
    if (!q) {
      const recent = store.get('lf.recent', []) || [];
      if (recent.length) {
        html += `<div class="sg-h">Recent<button type="button" id="rClear" aria-label="Clear recent">Clear</button></div>`;
        recent.forEach((r, i) => {
          sugg_items.push({ type: 'search', q: r });
          html += `<button class="sg" type="button" role="option" data-i="${sugg_items.length - 1}"><div class="sg-txt"><div class="sg-t">${esc(r)}</div></div></button>`;
        });
      }
    } else {
      const res = LF.searchMovies(q);
      if (!res.length) {
        html = `<div class="sg-empty">No titles match "${esc(q)}".</div>`;
      } else {
        res.slice(0, 6).forEach((m) => {
          sugg_items.push({ type: 'm', id: m.id });
          html += `<button class="sg" type="button" role="option" data-i="${sugg_items.length - 1}">
            <div class="sg-p poster" style="aspect-ratio:auto;border-radius:5px;box-shadow:none;min-height:46px">${m.poster === 'ready' ? `<img data-p="1" alt="" src="${posterUrl(m, 120)}" style="position:static;width:34px;height:50px;object-fit:cover">` : ''}</div>
            <div class="sg-txt"><div class="sg-t">${highlight(m.title, q)}</div><div class="sg-m">${esc([m.year, m.ext, m.subs ? 'Subtitles' : ''].filter(Boolean).join('  ·  '))}</div></div>
          </button>`;
        });
        sugg_items.push({ type: 'all', q });
        html += `<button class="sg sg-all" type="button" role="option" data-i="${sugg_items.length - 1}">See all ${res.length} result${res.length > 1 ? 's' : ''}</button>`;
      }
    }
    box.innerHTML = html; box.hidden = false; sq().setAttribute('aria-expanded', 'true'); sel = -1;
    settleImages(box);
  }
  function pickSugg(i) {
    const it = sugg_items[i]; if (!it) return;
    if (it.type === 'm') { pushRecent(sq().value); closeSugg(); location.hash = '#/movie/' + it.id; }
    else if (it.type === 'search') { sq().value = it.q; renderSugg(); }
    else { sq().value = it.q; runSearch(true); }
  }
  function runSearch(go) {
    const q = sq().value.trim(); closeSugg(); if (q) pushRecent(q);
    if (go || page === 'browse') {
      if (page !== 'browse' || location.hash.indexOf('#/browse') !== 0) { location.hash = '#/browse?q=' + encodeURIComponent(q) + '&sort=' + bstate.sort + '&dir=' + bstate.dir; }
      else setBrowse({ q });
    }
  }
  function setupSearch() {
    const q = sq(); let t;
    q.addEventListener('input', () => { $('#qclear').hidden = !q.value; renderSugg(); if (page === 'browse') { clearTimeout(t); t = setTimeout(() => { if (page === 'browse') setBrowse({ q: q.value.trim() }); }, 220); } });
    q.addEventListener('focus', () => renderSugg());
    q.addEventListener('keydown', (e) => {
      const open = !sg().hidden;
      if (LF.app && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        // TV: walk down the suggestion list without wrapping, then leave the field (the global handler moves focus).
        const down = e.key === 'ArrowDown', next = sel + (down ? 1 : -1);
        if (open && sugg_items.length && next >= 0 && next < sugg_items.length) {
          e.preventDefault(); e.stopPropagation(); sel = next;
          $$('.sg', sg()).forEach((b, i) => { b.setAttribute('aria-selected', i === sel); if (i === sel) b.scrollIntoView({ block: 'nearest' }); });
          return;
        }
        if (!down && sel >= 0) {
          e.preventDefault(); e.stopPropagation(); sel = -1;
          $$('.sg', sg()).forEach((b) => b.setAttribute('aria-selected', 'false'));
          return;
        }
        if (down) closeSugg();   // hide the dropdown so its rows are not picked as the next focus target
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!open) renderSugg(); if (!sugg_items.length) return;
        e.preventDefault(); e.stopPropagation();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + sugg_items.length) % sugg_items.length;
        $$('.sg', sg()).forEach((b, i) => { b.setAttribute('aria-selected', i === sel); if (i === sel) b.scrollIntoView({ block: 'nearest' }); });
      } else if (e.key === 'Enter') { e.preventDefault(); if (sel >= 0) pickSugg(sel); else runSearch(true); q.blur(); }
      else if (e.key === 'Escape') {
        if (open) { closeSugg(); e.stopPropagation(); } else if (q.value) { q.value = ''; $('#qclear').hidden = true; if (page === 'browse') setBrowse({ q: '' }); e.stopPropagation(); } else q.blur();
      }
    });
    $('#qclear').addEventListener('click', () => { q.value = ''; $('#qclear').hidden = true; closeSugg(); if (page === 'browse') setBrowse({ q: '' }); q.focus(); });
    sg().addEventListener('mousedown', (e) => e.preventDefault());
    sg().addEventListener('click', (e) => {
      if (e.target.closest('#rClear')) { store.set('lf.recent', []); closeSugg(); return; }
      const b = e.target.closest('.sg'); if (b) pickSugg(+b.dataset.i);
    });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('#search')) closeSugg(); });
    $('#btnSettings').addEventListener('click', () => { location.hash = '#/settings'; });
  }

  /* ---- focus nav (TV remote) ---- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select,[tabindex="0"]';
  function visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'); }
  // Determine if an element belongs to the topbar (navbar links, search, icon buttons)
  function isTopbarEl(el) {
    return el.closest('.topbar') !== null;
  }
  // Determine if the current focused element is a card in the grid
  function isBrowseCard(el) {
    return !!(el && el.closest('#bGrid, .row'));
  }

  function genericMove(dir, root) {
    root = root || document;
    const cur = document.activeElement;
    const els = $$(FOCUSABLE, root).filter((e) => e !== cur && e.tabIndex !== -1 && visible(e));
    if (!cur || cur === document.body || !root.contains(cur)) {
      const first = els.find((e) => e.getBoundingClientRect().bottom > 80);
      if (first) { first.focus(); return true; } return false;
    }
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    // When navigating UP from a browse card, ignore topbar elements unless nothing else is above
    const curInGrid = isBrowseCard(cur);
    let best = null, bs = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect(), ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = ex - cx, dy = ey - cy; let main, cross;
      if (dir === 'right') { if (r.left < cr.right - cr.width / 2 && dx <= 4) continue; main = dx; cross = Math.abs(dy); }
      else if (dir === 'left') { if (dx >= -4) continue; main = -dx; cross = Math.abs(dy); }
      else if (dir === 'down') { if (dy <= 4) continue; main = dy; cross = Math.abs(dx); }
      else { if (dy >= -4) continue; main = -dy; cross = Math.abs(dx); }
      if (main <= 0) continue;
      const overlap = (dir === 'left' || dir === 'right') ? !(r.bottom < cr.top || r.top > cr.bottom) : !(r.right < cr.left || r.left > cr.right);
      let sc = main + cross * (overlap ? 1.5 : 5);
      // Heavy penalty: when in the grid and pressing left/right, strongly discourage jumping to topbar
      if (curInGrid && isTopbarEl(el) && (dir === 'left' || dir === 'right')) sc += 9999;
      // When pressing up from a card, strongly prefer toolbar buttons over the search input
      if (curInGrid && dir === 'up' && el.id === 'q') sc += 8000;
      if (sc < bs) { bs = sc; best = el; }
    }
    if (best) {
      // If the best candidate is the topbar search input when going up from grid, skip to toolbar nav instead
      if (curInGrid && dir === 'up' && best === sq()) {
        const alt = els.filter((e) => isTopbarEl(e) && e !== sq() && e.getBoundingClientRect().bottom <= cy)
          .sort((a, b) => { const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect(); return Math.abs(ar.left + ar.width / 2 - cx) - Math.abs(br.left + br.width / 2 - cx); })[0];
        if (alt) { alt.focus({ preventScroll: true }); alt.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: LF.app ? 'auto' : 'smooth' }); return true; }
      }
      best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: LF.app ? 'auto' : 'smooth' }); return true;
    }
    return false;
  }

  /* ---- TV remote navigation (LF.app only) ----
     The old code measured EVERY focusable element on EVERY key press and started a new smooth scroll each time,
     which is why holding an arrow key stuttered. Now the TV app walks the page structure instead:
       - a card's left/right neighbours are its siblings, up/down is the row above / below (O(1), no measuring)
       - only the small "top zone" (navbar, hero buttons, browse toolbar) uses a distance search
       - the navbar can ONLY be reached from that top zone, never from the cards or the middle of the page
       - scrolling is one short animation that is re-aimed on every key press, so bursts never queue up      */
  const centerX = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
  const isCard = (el) => !!(el && el.classList && el.classList.contains('card'));
  const TOP_ZONE = '.topbar a[href],.topbar button,.topbar input,.hero .btn,.qtag button,.toolbar select,.toolbar button';
  function nearestX(list, x) {
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; i++) { const d = Math.abs(centerX(list[i]) - x); if (d < bd) { bd = d; best = list[i]; } }
    return best;
  }

  // one rAF loop animates every active scroll; a new target simply replaces the old one
  const anims = []; let animRaf = 0;
  const SCROLL_MS = 150;
  function stepAnims(now) {
    animRaf = 0;
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i], p = Math.min(1, (now - a.t0) / SCROLL_MS), e = 1 - Math.pow(1 - p, 3);
      a.el[a.prop] = a.from + (a.to - a.from) * e;
      if (p >= 1) anims.splice(i, 1);
    }
    if (anims.length) animRaf = requestAnimationFrame(stepAnims);
  }
  function animScroll(el, prop, target) {
    const max = prop === 'scrollTop' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    target = Math.max(0, Math.min(max, Math.round(target)));
    if (Math.abs(target - el[prop]) < 2) return;
    let a = anims.find((x) => x.el === el && x.prop === prop);
    if (!a) { a = { el, prop }; anims.push(a); }
    a.from = el[prop]; a.to = target; a.t0 = performance.now();
    if (!animRaf) animRaf = requestAnimationFrame(stepAnims);
  }

  // Keep the focused element inside the TV-safe part of the screen (cards are also scaled up when focused).
  function tvReveal(el) {
    const doc = document.scrollingElement || document.documentElement;
    if (el.closest('.topbar,.hero,.qtag,.toolbar,.ph1')) { animScroll(doc, 'scrollTop', 0); return; }
    const vh = window.innerHeight, bar = $('#topbar');
    const topLimit = (bar ? bar.offsetHeight : 0) + 8, botLimit = vh - Math.round(vh * 0.05) - 8;
    const row = el.closest('.row');
    if (row) {
      const rr = row.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 44;
      if (r.left < rr.left + pad) animScroll(row, 'scrollLeft', row.scrollLeft - (rr.left + pad - r.left));
      else if (r.right > rr.right - pad) animScroll(row, 'scrollLeft', row.scrollLeft + (r.right - (rr.right - pad)));
    }
    const r2 = el.getBoundingClientRect();
    if (r2.top < topLimit || r2.bottom > botLimit) {
      const ref = (row && el.closest('.sec')) || el, t = ref.getBoundingClientRect().top;
      animScroll(doc, 'scrollTop', doc.scrollTop + t - topLimit - (row ? 8 : 22));
    }
  }
  function tvFocus(el) {
    if (!el) return false;
    el.focus({ preventScroll: true });
    tvReveal(el);
    return true;
  }

  function gridCols(grid) {
    const k = grid.children; if (!k.length) return 1;
    const t = k[0].offsetTop; let c = 1;
    while (c < k.length && k[c].offsetTop === t) c++;
    return c;
  }
  // Browse loads its cards in pages; make sure the card we are about to step to exists.
  function browseEnsure(n) {
    const grid = $('#bGrid'); if (!grid) return;
    while (browseLoaded < n && browseLoaded < browseFiltered.length) appendBrowseCards(grid, browseLoaded, Math.min(browseLoaded + PAGE_SIZE, browseFiltered.length));
    if (browseLoaded >= browseFiltered.length) { const sn = $('#bSentinel'); if (sn) sn.hidden = true; if (browseObserver) browseObserver.disconnect(); }
  }

  function tvRowMove(dir, cur, row) {
    if (dir === 'left') { const p = cur.previousElementSibling; if (isCard(p)) tvFocus(p); return true; }
    if (dir === 'right') { const n = cur.nextElementSibling; if (isCard(n)) tvFocus(n); return true; }
    const x = centerX(cur), step = dir === 'down' ? 'nextElementSibling' : 'previousElementSibling';
    let s = cur.closest('.sec'); s = s && s[step];
    while (s) {
      const r = s.querySelector && s.querySelector('.row');
      if (r && r.children.length) return tvFocus(nearestX(r.children, x));
      s = s[step];
    }
    if (dir === 'up') return tvFocus(nearestX($$('.hero .btn'), x));   // first row -> hero buttons (the top section)
    return true;                                                         // last row: stay
  }

  function tvGridMove(dir, cur, grid) {
    const idx = Array.prototype.indexOf.call(grid.children, cur), cols = gridCols(grid), col = idx % cols;
    if (dir === 'left') { if (col > 0) tvFocus(grid.children[idx - 1]); return true; }
    if (dir === 'right') {
      if (idx + 1 >= grid.children.length) browseEnsure(idx + 2);
      if (col < cols - 1 && idx + 1 < grid.children.length) tvFocus(grid.children[idx + 1]);
      return true;
    }
    if (dir === 'down') {
      if (idx + cols >= grid.children.length) browseEnsure(idx + cols + 1);
      const k = grid.children, len = k.length;
      if (idx + cols < len) tvFocus(k[idx + cols]);
      else if (Math.floor(idx / cols) < Math.floor((len - 1) / cols)) tvFocus(k[len - 1]);   // last row is shorter
      else return true;
      setTimeout(() => browseEnsure(idx + cols * 4), 250);                                  // load the next page ahead of time
      return true;
    }
    if (idx - cols >= 0) return tvFocus(grid.children[idx - cols]);
    return tvFocus(nearestX($$('.toolbar select,.toolbar button'), centerX(cur)));             // first grid row -> toolbar (top section)
  }

  // Distance search among a handful of elements only.
  function pick(dir, cur, els) {
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bs = Infinity;
    for (const el of els) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy; let main, cross;
      if (dir === 'right') { if (dx <= 4) continue; main = dx; cross = Math.abs(dy); }
      else if (dir === 'left') { if (dx >= -4) continue; main = -dx; cross = Math.abs(dy); }
      else if (dir === 'down') { if (dy <= 4) continue; main = dy; cross = Math.abs(dx); }
      else { if (dy >= -4) continue; main = -dy; cross = Math.abs(dx); }
      const overlap = (dir === 'left' || dir === 'right') ? !(r.bottom < cr.top || r.top > cr.bottom) : !(r.right < cr.left || r.left > cr.right);
      const sc = main + cross * (overlap ? 1.5 : 5);
      if (sc < bs) { bs = sc; best = el; }
    }
    return best;
  }
  function tvTopMove(dir, cur) {
    const els = $$(TOP_ZONE).filter(visible);
    if (dir === 'down') {   // the only way from the navbar / hero / toolbar into the page body
      const grid = $('#bGrid');
      if (grid && grid.children.length) { const n = gridCols(grid); for (let i = 0; i < n && i < grid.children.length; i++) els.push(grid.children[i]); }
      else { const row = $('.sec .row'); if (row) for (let i = 0; i < row.children.length; i++) els.push(row.children[i]); }
    }
    return tvFocus(pick(dir, cur, els)) || true;
  }

  function tvMove(dir, root) {
    if (root !== document) return genericMove(dir, root);   // dialogs: only a few buttons, plain search is fine
    const cur = document.activeElement;
    if (!cur || cur === document.body || !document.contains(cur)) {
      return tvFocus($('.hero .btn.primary') || $('#bGrid .card') || $('.card') || $('.toolbar button'));
    }
    if (isCard(cur)) {
      const par = cur.parentElement;
      if (par.classList.contains('row')) return tvRowMove(dir, cur, par);
      if (par.id === 'bGrid') return tvGridMove(dir, cur, par);
    }
    if (cur.closest('.topbar,.hero,.qtag,.toolbar')) return tvTopMove(dir, cur);
    return genericMove(dir, root);
  }

  LF.moveFocus = function (dir, root) {
    root = root || document;
    return LF.app ? tvMove(dir, root) : genericMove(dir, root);
  };
  let pointerUsed = false;
  document.addEventListener('mousemove', () => { pointerUsed = true; document.body.classList.add('pointer'); }, { passive: true });
  const DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  let lastMoveAt = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // TV: holding OK must not fire again on whatever opens under it (details dialog -> Play -> player).
    if (LF.app && e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; }
    if (LF.player && LF.player.active) { if (LF.player.onKey(e)) return; }
    const tag = e.target.tagName, typing = (tag === 'INPUT' && !/range|checkbox|button/.test(e.target.type)) || tag === 'TEXTAREA';
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || (e.key === 'Backspace' && !typing)) {
      if (modalEl || /^\/(movie|watch|settings)/.test(location.hash.slice(2))) { e.preventDefault(); LF.closeOverlay(); return; }
      if (e.key === 'Backspace' || e.key === 'Escape') return;
    }
    if (e.key === '/' && !typing && !modalEl) { e.preventDefault(); sq().focus(); sq().select(); return; }
    const dir = DIRS[e.key]; if (!dir) return;
    if (LF.app && typing) {
      // TV: arrows must be able to leave a text field. Left/Right still move the caret while there is text to move over.
      const el = e.target;
      try { if ((dir === 'left' && el.selectionStart > 0) || (dir === 'right' && el.selectionEnd < el.value.length)) return; } catch { /* type has no caret */ }
    } else if (typing || (tag === 'SELECT' && !LF.app)) return;
    if (e.target.getAttribute && e.target.getAttribute('role') === 'slider') return;
    if (tag === 'INPUT' && e.target.type === 'range' && (dir === 'left' || dir === 'right')) return;
    const root = modalEl || document;
    if (document.activeElement === document.body && !LF.tv && pointerUsed && !modalEl) return;
    e.preventDefault();
    if (LF.app) {
      // Held arrow keys repeat faster than the TV can draw: take one step per ~90 ms and drop the rest (no backlog).
      const t = performance.now();
      if (e.repeat && t - lastMoveAt < 90) return;
      lastMoveAt = t;
    }
    LF.moveFocus(dir, root);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && modalEl) {
      const f = $$(FOCUSABLE, modalEl).filter(visible); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---- Android TV app helpers (only active when LF.app) ---- */
  // Remember the card the user was on so focus can return there after a modal or the native player closes.
  document.addEventListener('focusin', (e) => {
    const c = e.target.closest && e.target.closest('.card');
    if (c) { LF.lastCardEl = c; LF.lastCardId = c.dataset.id; }
  });
  LF.restoreFocus = function () {
    const a = document.activeElement;
    if (a && a !== document.body && document.contains(a) && !a.closest('[hidden]')) return;
    let el = LF.lastCardEl && document.contains(LF.lastCardEl) ? LF.lastCardEl : null;
    if (!el && LF.lastCardId) el = $('.card[data-id="' + LF.lastCardId + '"]');
    if (!el) el = $('.hero .btn.primary') || $('#bGrid .card') || $('.card');
    if (el) el.focus({ preventScroll: true });
  };
  const overlayHash = () => /^\/(movie|watch|settings)/.test(location.hash.slice(1));
  // True when pressing Back would have nothing left to close inside the page, i.e. the app may exit.
  LF.isRoot = () => !modalEl && page !== 'browse' && !overlayHash() && sg().hidden && document.activeElement !== sq();
  let lastRoot = null;
  LF.reportRoot = function () {
    if (!window.LocalFlixTV) return;
    const r = LF.isRoot();
    if (r !== lastRoot) { lastRoot = r; try { window.LocalFlixTV.atRoot(r); } catch { /* bridge missing */ } }
  };
  // The native Back key lands here first. Return true if the page used it, false if the app should exit.
  LF.onNativeBack = function () {
    if (!sg().hidden || document.activeElement === sq()) { closeSugg(); sq().blur(); return true; }
    if (modalEl) { LF.closeOverlay(); return true; }
    if (overlayHash()) { location.hash = '#/'; return true; }
    if (page === 'browse') { location.hash = '#/'; return true; }
    return false;
  };
  function setupTv() {
    // 1. Tell the app whether Back would exit (hash change, focus change, modal open/close).
    const rr = () => setTimeout(LF.reportRoot, 0);
    window.addEventListener('hashchange', rr);
    document.addEventListener('focusin', rr); document.addEventListener('focusout', rr);
    new MutationObserver(rr).observe($('#modalRoot'), { childList: true });
    rr();
    // 2. Text fields: stay silent until OK is pressed, so merely moving over the search box does not pop up the keyboard.
    const isText = (el) => el && el.tagName === 'INPUT' && /^(text|search|url|email|tel|password)$/.test(el.type || 'text');
    // The WebView must never raise its own keyboard (it does not appear on many TVs); OK opens the app's own text box.
    document.addEventListener('focusin', (e) => { if (isText(e.target)) e.target.setAttribute('inputmode', 'none'); });
    let pendingField = null;
    // Called by the app when the text box closes: text = what was typed, null = cancelled; submit = OK / Search pressed.
    LF.onNativeText = function (text, submit) {
      const t = pendingField; pendingField = null;
      if (!t) return;
      try { t.focus({ preventScroll: true }); } catch { /* gone */ }
      if (text == null) return;
      t.value = text;
      t.dispatchEvent(new Event('input', { bubbles: true }));
      if (submit && t.id === 'q') runSearch(true);
    };
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      // Some TV builds report the remote's OK button as keyCode 23 (DPAD_CENTER) instead of key "Enter".
      if (!(e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) || !isText(t) || t.readOnly) return;
      if (t.id === 'q' && sel >= 0) return;            // OK on a highlighted suggestion opens it
      if (!(window.LocalFlixTV && window.LocalFlixTV.editText)) return;   // older app build: nothing to open
      e.preventDefault(); e.stopPropagation();
      pendingField = t;
      const lbl = t.getAttribute('aria-label') || t.placeholder || 'Enter text';
      try { window.LocalFlixTV.editText(lbl, t.value || '', t.placeholder || '', t.type === 'search' ? 'search' : (t.type || 'text')); }
      catch { pendingField = null; }
    }, true);
    // 3. The suggestion dropdown must never stay open over the page once focus has left the search box.
    sq().addEventListener('blur', closeSugg);
    // 4. While a dialog (movie details / settings) is open, focus can never leave it. Before, a stray focus() or
    //    key press could land on the navbar or the next section behind the dialog.
    document.addEventListener('focusin', (e) => {
      if (!modalEl) return;
      if (modalEl.contains(e.target)) { modalEl._last = e.target; return; }
      const back = (modalEl._last && modalEl.contains(modalEl._last) && modalEl._last) || $('#dPlay,#sChange,.btn,.inp,.m-close', modalEl);
      if (back) back.focus({ preventScroll: true });
    }, true);
  }

  /* ---- routing ---- */
  LF.load = async function (render) {
    try {
      const [movies, info] = await Promise.all([LF.api('/api/movies'), LF.api('/api/info')]);
      LF.movies = prep(movies); LF.info = info; LF.offline = false;
    } catch (err) {
      LF.offline = true;
      if (!LF.movies) { LF.movies = []; $('#main').innerHTML = errorState(err.message); return false; }
    }
    if (render !== false) route(true);
    return true;
  };
  let pollTimer, polls = 0;
  async function tick() {
    const delay = LF.info && LF.info.poster_pending > 0 && polls < 60 ? 3500 : 45000;
    pollTimer = setTimeout(async () => {
      polls++;
      try {
        // Only a changed list of movies re-renders the page. A finished poster is swapped in place below,
        // otherwise the page (and the TV focus ring) would be rebuilt every few seconds while posters download.
        const sig = () => LF.movies.map((m) => m.id).join('|');
        const before = sig(); const old = new Map(LF.movies.map((m) => [m.id, m.pv]));
        const [movies, info] = await Promise.all([LF.api('/api/movies'), LF.api('/api/info')]);
        LF.movies = prep(movies); LF.info = info;
        if (sig() !== before && !modalEl && !(LF.player && LF.player.active) && document.activeElement !== sq()) route(true);
        else LF.movies.forEach((m) => {
          if (old.get(m.id) === m.pv) return;
          document.querySelectorAll(`.poster[data-id="${m.id}"]`).forEach((p) => {
            const img = p.querySelector('img[data-p]'); if (img) img.remove();
            const ph = p.querySelector('.ph'); if (ph) { ph.classList.remove('shim'); if (m.poster === 'ready') ph.innerHTML = ''; }
            if (m.poster === 'ready') { const ni = document.createElement('img'); ni.dataset.p = '1'; ni.alt = ''; ni.decoding = 'async'; ni.src = posterUrl(m); ni.addEventListener('load', () => ni.classList.add('ld')); p.insertBefore(ni, p.firstChild); }
          });
        });
      } catch { /* offline */ }
      tick();
    }, delay);
  }

  function route(force) {
    const h = location.hash.replace(/^#/, '') || '/';
    const qi = h.indexOf('?'), path = qi < 0 ? h : h.slice(0, qi), qs = new URLSearchParams(qi < 0 ? '' : h.slice(qi + 1));
    const parts = path.split('/').filter(Boolean), k = parts[0] || 'home';
    const overlay = k === 'movie' || k === 'watch' || k === 'settings';
    if (!overlay) {
      closeModal();
      if (LF.player && LF.player.active) LF.player.close(true);
      const kind = k === 'browse' ? 'browse' : 'home';
      if (force || kind !== page || (kind === 'browse' && h !== LF.pageHash)) renderPage(kind, { q: qs });
      LF.pageHash = h; LF.wasOverlay = false; return;
    }
    if (!page) renderPage('home', { q: new URLSearchParams() });
    if (!LF.wasOverlay) LF.fromPage = !!LF.routed;
    LF.wasOverlay = true;
    if (k === 'watch') {
      closeModal(true);
      const m = byId(parts[1]);
      if (!m) { LF.toast('That movie is no longer in the library.'); location.replace('#/'); return; }
      LF.player.open(m, { startAt: qs.has('t') ? parseFloat(qs.get('t')) : null });
    } else {
      if (LF.player && LF.player.active) LF.player.close(true);
      if (k === 'movie') showDetail(parts[1]); else showSettings();
    }
  }

  LF.start = async function () {
    setupSearch();
    if (LF.app) setupTv();
    if (LF.app) { try { LF.importNativeProgress(JSON.parse(window.LocalFlixTV.getResume())); } catch { /* older app build: no bridge method */ } }
    $('#main').innerHTML = '<div class="page"><div class="grid" style="margin-top:40px">' + '<div class="skel"></div>'.repeat(20) + '</div></div>';
    window.addEventListener('hashchange', () => { LF.routed = true; route(); });
    const ok = await LF.load(false);
    if (ok) { route(true); LF.routed = true; tick(); }
  };
})();
