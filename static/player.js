/* LocalFlix video player: custom controls, subtitles, audio tracks, resume, compat mode, keyboard, touch, TV remote. */
'use strict';
(function () {
  const LF = window.LF, $ = LF.$, esc = LF.esc, fmt = LF.fmtTime;
  const P = (LF.player = { active: false });
  let root, v, E = {};
  let m = null, d = null, mode = 'direct', tOff = 0, audioN = 0, startAt = 0, wantAt = null;
  let tracks = [], curTrack = null, cues = [], subOffset = 0, menuView = '', hideT = null, saveT = 0, fellBack = false;
  let dragging = false, pendingT = null, pendingTimer = null, endTimer = null, tapT = 0, tapX = 0, clickT = null, inited = false, subSearchT = null;
  const COLORS = [['#ffffff', 'White'], ['#ffe14d', 'Yellow'], ['#66e0ff', 'Cyan'], ['#7dff9b', 'Green']];
  const ERR_CODEC = ['ac3', 'eac3', 'dts', 'dca', 'truehd', 'mlp'];
  const TEXT_SUB = ['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'subviewer'];

  const langName = (c) => {
    if (!c) return '';
    try { const n = new Intl.DisplayNames(['en'], { type: 'language' }).of(c); if (n && n !== c) return n; } catch { /* unsupported */ }
    return c.toUpperCase();
  };
  const total = () => d && d.dur ? d.dur : (isFinite(v.duration) && v.duration ? v.duration + tOff : 0);
  const now = () => (pendingT != null ? pendingT : tOff + (v.currentTime || 0));
  const icon = (id) => `<svg class="ic"><use href="#i-${id}"/></svg>`;
  const setIcon = (btn, id) => btn.querySelector('use').setAttribute('href', '#i-' + id);

  /* ---- init ---- */
  function init() {
    if (inited) return; inited = true;
    root = $('#player'); v = $('#v');
    ['pTitle', 'pSub', 'pSpin', 'pBig', 'pFlash', 'bPlay', 'pBack', 'bFwd', 'bBack', 'bMute', 'vol', 'tCur', 'tDur',
      'bNext', 'bSubs', 'bAudio', 'bSet', 'bPip', 'bFull', 'seek', 'sBuf', 'sFill', 'sThumb', 'sTip',
      'pMenu', 'pToast', 'endCard', 'pErr', 'subFile', 'cues', 'pBottom'].forEach((id) => { E[id] = $('#' + id); });

    E.pBack.onclick = () => P.close();
    E.bPlay.onclick = E.pBig.onclick = togglePlay;
    E.bBack.onclick = () => skip(-10); E.bFwd.onclick = () => skip(10);
    E.bMute.onclick = () => { v.muted = !v.muted; };
    E.vol.oninput = () => { v.volume = +E.vol.value; v.muted = v.volume === 0; };
    E.bNext.onclick = () => goNext();
    E.bSubs.onclick = () => toggleMenu('subs');
    E.bAudio.onclick = () => toggleMenu('audio');
    E.bSet.onclick = () => toggleMenu('set');
    E.bFull.onclick = toggleFS;
    if (!document.pictureInPictureEnabled) E.bPip.hidden = true;
    E.bPip.onclick = () => { if (document.pictureInPictureElement) document.exitPictureInPicture(); else v.requestPictureInPicture().catch(() => {}); };
    if (!root.requestFullscreen && !root.webkitRequestFullscreen) E.bFull.hidden = true;
    document.addEventListener('fullscreenchange', () => setIcon(E.bFull, document.fullscreenElement ? 'unfull' : 'full'));
    document.addEventListener('webkitfullscreenchange', () => setIcon(E.bFull, document.webkitFullscreenElement ? 'unfull' : 'full'));

    v.addEventListener('play', () => { updatePlay(); showUI(); });
    v.addEventListener('pause', () => { updatePlay(); saveProgress(true); showUI(); });
    v.addEventListener('playing', () => { E.pSpin.hidden = true; E.pBig.hidden = true; hideErr(); updatePlay(); });
    v.addEventListener('waiting', () => { E.pSpin.hidden = false; });
    v.addEventListener('canplay', () => { E.pSpin.hidden = true; });
    v.addEventListener('seeked', () => { E.pSpin.hidden = true; });
    v.addEventListener('volumechange', updateVol);
    v.addEventListener('timeupdate', () => { tickTime(); if (Date.now() - saveT > 5000) saveProgress(); });
    v.addEventListener('progress', drawBuf);
    v.addEventListener('durationchange', tickTime);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);
    v.addEventListener('loadedmetadata', () => {
      if (mode === 'direct' && wantAt > 0) { try { v.currentTime = wantAt; } catch { /* ignore */ } }
      wantAt = null;
      if (mode === 'direct' && v.videoWidth === 0 && LF.info && LF.info.ffmpeg && !fellBack) fallback('This file has no picture the browser can show');
      tickTime();
    });

    // Sub render loop
    (function loop() { if (P.active && !v.paused) renderCues(); requestAnimationFrame(loop); })();

    /* seek bar */
    const frac = (e) => { const r = E.seek.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    E.seek.addEventListener('pointerdown', (e) => { dragging = true; E.seek.classList.add('drag'); E.seek.setPointerCapture(e.pointerId); preview(frac(e), true); });
    E.seek.addEventListener('pointermove', (e) => { if (dragging) preview(frac(e), true); else showTip(frac(e)); });
    E.seek.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; E.seek.classList.remove('drag'); seekTo(frac(e) * total()); E.sTip.hidden = true; });
    E.seek.addEventListener('pointerleave', () => { if (!dragging) E.sTip.hidden = true; });
    E.seek.addEventListener('keydown', (e) => {
      const t = total();
      if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(now() + (e.shiftKey ? 60 : 10)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(now() - (e.shiftKey ? 60 : 10)); }
    });
    function showTip(f) { const t = total(); if (!t) return; E.sTip.hidden = false; E.sTip.textContent = fmt(f * t); E.sTip.style.left = (f * 100) + '%'; }
    function preview(f, tip) { setSeekUI(f * total()); if (tip) showTip(f); }

    /* pointer on picture */
    const isCtl = (el) => el.closest('.p-top,.p-bottom,.pmenu,.endcard,.perr,.big-play,.ptoast');
    root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showUI(); });
    root.addEventListener('pointerup', (e) => {
      if (isCtl(e.target) || e.button > 0) return;
      if (menuView) { closeMenu(); return; }
      if (e.pointerType === 'mouse') {
        if (clickT) { clearTimeout(clickT); clickT = null; toggleFS(); return; }
        clickT = setTimeout(() => { clickT = null; togglePlay(); }, 240); return;
      }
      const t = Date.now(), x = e.clientX / root.clientWidth;
      if (t - tapT < 320 && Math.abs(x - tapX) < 0.2) {
        tapT = 0; clearTimeout(clickT); clickT = null;
        if (x < 0.35) skip(-10); else if (x > 0.65) skip(10); else togglePlay();
      } else {
        tapT = t; tapX = x;
        clickT = setTimeout(() => { clickT = null; if (root.classList.contains('hide-ui')) showUI(true); else hideUI(); }, 300);
      }
    });
    root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drop'); });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', (e) => { e.preventDefault(); root.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) uploadSub(f); });
    E.subFile.onchange = () => { if (E.subFile.files[0]) uploadSub(E.subFile.files[0]); E.subFile.value = ''; };
    E.pMenu.addEventListener('click', onMenuClick);
    window.addEventListener('resize', applySubStyle);
    root.addEventListener('focusin', () => showUI());
    // While a player menu is open the remote must never escape to the video controls behind it.
    // This mirrors the modal focusin trap in app.js.
    document.addEventListener('focusin', (e) => {
      if (!menuView || !E.pMenu || E.pMenu.hidden) return;
      if (E.pMenu.contains(e.target)) { E.pMenu._last = e.target; return; }
      const back = (E.pMenu._last && E.pMenu.contains(E.pMenu._last) ? E.pMenu._last : null)
        || E.pMenu.querySelector('[aria-checked="true"]') || E.pMenu.querySelector('.pm-i,button');
      if (back) back.focus({ preventScroll: true });
    }, true);

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => v.play());
        navigator.mediaSession.setActionHandler('pause', () => v.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
        navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
        navigator.mediaSession.setActionHandler('nexttrack', () => d && d.next && goNext());
      } catch { /* unsupported */ }
    }
  }

  /* ---- Android TV app: hand playback to the native ExoPlayer ---- */
  // Only runs inside the LocalFlix TV app (window.LocalFlixTV is injected by the app's WebView).
  // Normal browsers never reach this code, so phones and laptops keep using the <video> player below.
  const nativeDur = {};
  async function openNative(movie, opts) {
    let det = null;
    // The details request doubles as the "is the laptop there?" check before the TV player opens.
    const slow = setTimeout(() => LF.toast('Connecting to your laptop...'), 1500);
    try { det = await LF.api('/api/movies/' + movie.id); }
    catch (err) {
      det = null;
      if (err && err.offline) {
        clearTimeout(slow);
        // Back to the page underneath (the page keeps working from what it already knows). No dialog: a short toast,
        // the page's quiet reconnect loop does the rest.
        location.replace('#' + (LF.pageHash || '/'));
        LF.notice({ offline: true });
        return;
      }
    }
    clearTimeout(slow);
    const abs = (path) => location.origin + path;
    // Same resume rule as the web player (see P.open below).
    const prog = LF.progress.get(movie.id);
    const resumable = prog && prog.t > 10 && prog.d && prog.t < prog.d - 30;
    const explicitStart = !!(opts && opts.startAt != null && !isNaN(opts.startAt));
    const startAt = explicitStart ? opts.startAt : (resumable ? prog.t : 0);
    // Subtitle list: same tracks the web player offers, as absolute WebVTT URLs.
    const subtitles = ((det && det.tracks) || []).map((t) => ({
      label: t.label, lang: t.lang || '', url: abs('/api/subtitle/' + t.id + '.vtt') }));
    (((det && det.probe && det.probe.subs) || []).filter((x) => TEXT_SUB.indexOf(x.codec) >= 0)).forEach((x, i) => {
      subtitles.push({ label: x.title || langName(x.lang) || 'Embedded ' + (i + 1), lang: x.lang || '',
        url: abs('/api/embedded-subtitle/' + movie.id + '/' + x.n + '.vtt') });
    });
    // Audio tracks of the file (used by the native player when it has to switch to transcode mode).
    const audio = (((det && det.probe && det.probe.audio) || [])).map((a) => ({
      n: a.n, label: a.title || langName(a.lang) || 'Track ' + (a.n + 1), codec: a.codec || '', ch: a.ch || 0 }));
    const nx = det && det.next ? LF.movies.find((x) => x.id === det.next) : null;
    const dur = (det && det.dur) || movie.dur || 0;
    nativeDur[movie.id] = dur;
    const payload = {
      id: movie.id, title: movie.title, year: movie.year || null, ext: movie.ext || '',
      height: (det && det.probe && det.probe.video && det.probe.video.h) || 0,
      streamUrl: abs('/media/' + movie.id), transcodeUrl: abs('/transcode/' + movie.id),
      startSeconds: startAt || 0, duration: dur, subtitles, audio,
      nextId: det && det.next ? det.next : null, nextTitle: nx ? nx.title : null,
      ffmpeg: !!(LF.info && LF.info.ffmpeg),
      askResume: !explicitStart && !!resumable,   // the TV player then asks "Resume / Start over"
    };
    try { window.LocalFlixTV.play(JSON.stringify(payload)); } catch { LF.toast('Could not start the TV player.'); }
    // Leave the #/watch/ID URL (like P.close does) so the page underneath is ready when the native player closes.
    location.replace('#' + (LF.pageHash || '/'));
  }
  // Called by the app when the native player closes. Stores resume progress exactly like saveProgress() does.
  LF.onNativePlayerClosed = function (id, secs, finished, nextId) {
    const dur = nativeDur[id] || (LF.movies.find((x) => x.id === id) || {}).dur || 0;
    if (finished) LF.progress.markWatched(id);
    else if (secs >= 5) { if (dur && secs > dur - 45) LF.progress.markWatched(id); else LF.progress.set(id, secs, dur); }
    if (LF.restoreFocus) LF.restoreFocus();
    // "Play next" was chosen in the native player: open it like goNext() does.
    if (nextId) location.replace('#/watch/' + nextId);
  };

  /* ---- open / close ---- */
  P.open = async function (movie, opts) {
    if (window.LocalFlixTV) return openNative(movie, opts);
    init();
    if (P.active && m && m.id === movie.id) return;
    if (P.active) P.close(true);
    m = movie; d = null; tracks = []; curTrack = null; cues = []; fellBack = false; audioN = 0;
    pendingT = null; menuView = '';
    P.active = true; root.hidden = false; document.body.classList.add('noscroll');
    root.classList.toggle('fill', LF.prefs.fit === 'cover');
    v.volume = LF.prefs.volume; v.muted = LF.prefs.muted; E.vol.value = v.volume;
    E.pTitle.textContent = m.title;
    E.pSub.textContent = [m.year, m.ext].filter(Boolean).join('  ·  ');
    E.cues.innerHTML = ''; E.endCard.hidden = true; E.pMenu.hidden = true; hideErr();
    E.bNext.hidden = true; E.bAudio.hidden = true; E.pSpin.hidden = false; E.pBig.hidden = true;
    updateVol(); updatePlay(); applySubStyle(); showUI();
    document.title = m.title + ' - LocalFlix';
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: m.title, artist: 'LocalFlix' }); } catch { /* ignore */ }
    }
    try { d = await LF.api('/api/movies/' + m.id); } catch { d = null; }
    if (!P.active || !m || m.id !== movie.id) return;
    const prog = LF.progress.get(m.id);
    const resumable = prog && prog.t > 10 && prog.d && prog.t < prog.d - 30;
    startAt = opts && opts.startAt != null && !isNaN(opts.startAt) ? opts.startAt : (resumable ? prog.t : 0);
    mode = chooseMode();
    if (d) {
      E.bNext.hidden = !d.next;
      E.bAudio.hidden = !((d.probe && d.probe.audio || []).length >= 2);
      const vi = d.probe && d.probe.video;
      if (vi && vi.h) E.pSub.textContent = [m.year, vi.h + 'p', m.ext].filter(Boolean).join('  ·  ');
      buildTracks(); autoSubs();
    }
    loadSource(startAt);
    if (startAt > 10 && !(opts && opts.startAt != null)) {
      toast('Resumed at ' + fmt(startAt), { label: 'Start over', fn: () => seekTo(0) }, 6000);
    }
  };

  P.close = function (silent) {
    if (!P.active) return;
    saveProgress(true);
    P.active = false; clearTimeout(hideT); clearTimeout(endTimer); clearTimeout(pendingTimer);
    v.pause(); v.removeAttribute('src'); v.load();
    root.hidden = true; root.classList.remove('hide-ui');
    if (!$('#modalRoot').firstChild) document.body.classList.remove('noscroll');
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch { /* ignore */ } }
    document.title = 'LocalFlix'; m = null; d = null;
    if (!silent) {
      // Replace current history entry so the #/watch/ID URL is gone.
      // Navigate to the last non-overlay page (home / browse) so the user
      // doesn't land back on the detail modal when they next press Browse.
      location.replace('#' + (LF.pageHash || '/'));
    }
  };


  function chooseMode() {
    const pm = LF.prefs.playMode, ff = LF.info && LF.info.ffmpeg;
    if (!ff || pm === 'direct') return 'direct';
    if (pm === 'compat') return 'compat';
    const ext = m.ext.toLowerCase();
    if (['avi', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', '3gp'].indexOf(ext) >= 0) return 'compat';
    const p = d && d.probe;
    if (p) {
      const a = p.audio && p.audio[0];
      if (a && ERR_CODEC.indexOf(a.codec) >= 0 && !v.canPlayType('audio/mp4; codecs="ac-3"')) return 'compat';
      const vc = p.video && p.video.codec;
      if (vc === 'hevc' && !v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"')) return 'compat';
      if (['vc1', 'mpeg2video', 'mpeg4', 'msmpeg4v3', 'wmv3', 'wmv2', 'vp6f', 'rv40', 'theora'].indexOf(vc) >= 0) return 'compat';
    }
    return 'direct';
  }

  function loadSource(t) {
    E.pSpin.hidden = false; hideErr();
    if (mode === 'compat') { tOff = t || 0; wantAt = null; v.src = `/transcode/${m.id}?start=${tOff.toFixed(2)}&audio=${audioN}`; }
    else { tOff = 0; wantAt = t || 0; v.src = '/media/' + m.id; }
    v.playbackRate = LF.prefs.speed;
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => { E.pSpin.hidden = true; E.pBig.hidden = false; });
    setSeekUI(t || 0);
  }

  function fallback(why) {
    fellBack = true; mode = 'compat';
    toast(why + '. Switching to compatibility mode.', null, 4000);
    loadSource(Math.max(now(), 0));
  }

  function onError() {
    if (!P.active || !v.getAttribute('src')) return;
    if (mode === 'direct' && LF.info && LF.info.ffmpeg && !fellBack) { fallback('This format is not supported by this device'); return; }
    E.pSpin.hidden = true;
    const ff = LF.info && LF.info.ffmpeg;
    E.pErr.innerHTML = `<h2>This video cannot be played</h2><p>${ff ? 'Even compatibility mode could not open the file. It may be damaged or use an unusual format.' : 'This device cannot decode this file. Install ffmpeg on the computer running LocalFlix to enable automatic conversion, or convert the file to MP4.'}</p><div class="actions"><button class="btn primary" id="errRetry" type="button">Try again</button><button class="btn ghost" id="errBack" type="button">Back to library</button></div>`;
    E.pErr.hidden = false;
    $('#errRetry').onclick = () => { fellBack = false; hideErr(); loadSource(now()); };
    $('#errBack').onclick = () => P.close();
    $('#errRetry').focus();
  }
  function hideErr() { E.pErr.hidden = true; }

  /* ---- playback controls ---- */
  function togglePlay() {
    if (v.paused || v.ended) { if (v.ended) seekTo(0); v.play().catch(() => {}); flash('play'); }
    else { v.pause(); flash('pause'); }
  }
  function skip(sec) {
    const t = Math.max(0, Math.min(total() || 1e9, now() + sec));
    flash(sec < 0 ? 'l' : 'r', (sec < 0 ? '-' : '+') + Math.abs(sec) + 's');
    if (mode === 'compat') {
      pendingT = t; setSeekUI(t); clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { const x = pendingT; pendingT = null; seekTo(x); }, 380);
    } else seekTo(t);
  }
  function seekTo(t) {
    const tt = total(); t = Math.max(0, Math.min(tt ? tt - 0.2 : t, t));
    pendingT = null; E.endCard.hidden = true; clearTimeout(endTimer);
    if (mode === 'compat') { loadSource(t); }
    else { try { v.currentTime = t; } catch { /* not ready */ } }
    setSeekUI(t);
  }
  function goNext() { if (d && d.next) { saveProgress(true); location.replace('#/watch/' + d.next); } }
  function onEnded() {
    LF.progress.markWatched(m.id); showUI(true);
    if (d && d.next && LF.prefs.autoNext) {
      const nx = LF.movies.find((x) => x.id === d.next); let n = 8;
      const draw = () => {
        E.endCard.innerHTML = `<h3>Up next in ${n}</h3><p>${esc(nx ? nx.title : 'Next')}</p><div class="actions"><button class="btn primary" id="ecPlay" type="button">${icon('play')}Play now</button><button class="btn ghost" id="ecNo" type="button">Cancel</button></div>`;
        $('#ecPlay').onclick = goNext;
        $('#ecNo').onclick = () => { clearTimeout(endTimer); E.endCard.hidden = true; };
      };
      E.endCard.hidden = false; draw(); $('#ecPlay').focus();
      (function step() { endTimer = setTimeout(() => { n--; if (n <= 0) goNext(); else { draw(); step(); } }, 1000); })();
    }
  }
  function saveProgress(force) {
    if (!m || !v.getAttribute('src')) return;
    saveT = Date.now();
    const t = now(), tt = total(); if (t < 5) return;
    if (tt && t > tt - 45) { if (force || v.ended) LF.progress.markWatched(m.id); return; }
    LF.progress.set(m.id, t, tt);
  }

  /* ---- UI state ---- */
  function updatePlay() {
    const paused = v.paused;
    setIcon(E.bPlay, paused ? 'play' : 'pause'); E.bPlay.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    E.pBig.hidden = !(paused && E.pSpin.hidden && !v.ended) || !!E.pErr.offsetParent;
    if (!paused) E.pBig.hidden = true;
  }
  function updateVol() {
    setIcon(E.bMute, v.muted || v.volume === 0 ? 'mute' : 'vol');
    E.bMute.setAttribute('aria-label', v.muted ? 'Unmute' : 'Mute');
    E.vol.value = v.muted ? 0 : v.volume;
    LF.prefs.volume = v.volume || LF.prefs.volume || 1; LF.prefs.muted = v.muted; LF.savePrefs();
  }
  function setSeekUI(t) {
    const tt = total(), f = tt ? Math.min(1, t / tt) : 0;
    E.sFill.style.width = (f * 100) + '%'; E.sThumb.style.left = (f * 100) + '%';
    E.tCur.textContent = fmt(t); E.tDur.textContent = tt ? fmt(tt) : '--:--';
    E.seek.setAttribute('aria-valuenow', Math.round(f * 100));
    E.seek.setAttribute('aria-valuetext', fmt(t) + ' of ' + (tt ? fmt(tt) : 'unknown'));
  }
  function tickTime() { if (!dragging && P.active) { setSeekUI(now()); drawBuf(); renderCues(); } }
  function drawBuf() {
    const tt = total(); if (!tt || !v.buffered.length) { E.sBuf.style.width = '0'; return; }
    E.sBuf.style.width = Math.min(100, ((tOff + v.buffered.end(v.buffered.length - 1)) / tt) * 100) + '%';
  }
  function showUI(keep) {
    root.classList.remove('hide-ui'); clearTimeout(hideT);
    if (keep === true) return;
    hideT = setTimeout(() => { if (!v.paused && !menuView && !dragging && !root.contains(document.activeElement && document.activeElement.closest('.pmenu'))) hideUI(); }, 3500);
  }
  function hideUI() {
    if (v.paused || menuView) return;
    root.classList.add('hide-ui');
    if (root.contains(document.activeElement) && document.activeElement !== document.body) document.activeElement.blur();
  }
  function flash(kind, text) {
    const f = E.pFlash; f.hidden = true; void f.offsetWidth;
    f.className = 'flash ' + (kind === 'l' ? 'l' : kind === 'r' ? 'r' : 'c');
    f.innerHTML = kind === 'play' ? icon('play') : kind === 'pause' ? icon('pause') : (text || '');
    f.hidden = false; clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, 560);
  }
  function toast(msg, action, ms) {
    const t = E.pToast;
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" id="ptAct">${esc(action.label)}</button>` : ''}`;
    t.hidden = false;
    if (action) $('#ptAct').onclick = () => { action.fn(); t.hidden = true; };
    clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function toggleFS() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const f = root.requestFullscreen || root.webkitRequestFullscreen;
      if (f) f.call(root).catch(() => {});
    }
  }

  /* ---- subtitles ---- */
  function buildTracks() {
    tracks = ((d && d.tracks) || []).map((t) => ({ id: t.id, label: t.label, lang: t.lang, ext: t.ext, url: '/api/subtitle/' + t.id, sub: t.name }));
    const esubs = (d && d.probe && d.probe.subs) || [];
    esubs.filter((s) => TEXT_SUB.indexOf(s.codec) >= 0).forEach((s, i) => {
      tracks.push({ id: 'emb' + s.n, label: s.title || langName(s.lang) || 'Embedded ' + (i + 1), lang: langName(s.lang), ext: 'Embedded', url: '/api/embedded-subtitle/' + m.id + '/' + s.n, sub: 'Built into the video file' });
    });
  }
  function autoSubs() {
    if (!LF.prefs.subsOn || !tracks.length) return;
    const want = (LF.prefs.subLang || '').toLowerCase();
    const t = tracks.find((x) => want && ((x.lang || '').toLowerCase() === want || x.label.toLowerCase().startsWith(want))) || tracks[0];
    selectTrack(t, false);
  }
  async function selectTrack(t, remember) {
    if (!t) {
      curTrack = null; cues = []; E.cues.innerHTML = '';
      if (remember) { LF.prefs.subsOn = false; LF.savePrefs(); toast('Subtitles off'); }
      markCC(); return;
    }
    try {
      const j = await LF.api(t.url);
      curTrack = t; cues = (j.cues || []).slice().sort((a, b) => a[0] - b[0]);
      subOffset = LF.store.get('lf.suboff.' + m.id, 0) || 0;
      if (remember) { LF.prefs.subsOn = true; LF.prefs.subLang = t.lang || t.label; LF.savePrefs(); toast('Subtitles: ' + t.label); }
      markCC(); renderCues();
    } catch { toast('Could not load that subtitle file.'); }
  }
  const markCC = () => E.bSubs.classList.toggle('on', !!curTrack);
  function renderCues() {
    const box = E.cues;
    if (menuView === 'style' && !curTrack) { box.innerHTML = '<span>Subtitle preview</span>'; return; }
    if (!curTrack || !cues.length) { if (box.firstChild) box.innerHTML = ''; return; }
    const t = now() - subOffset;
    let lo = 0, hi = cues.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cues[mid][0] <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    let txt = '';
    for (let i = idx; i >= 0 && i > idx - 3; i--) if (cues[i][1] > t) txt = cues[i][2] + (txt ? '\n' + txt : '');
    if (box._txt === txt) return;
    box._txt = txt; box.innerHTML = '';
    if (txt) { const s = document.createElement('span'); s.textContent = txt; box.appendChild(s); }
  }
  function applySubStyle() {
    const s = LF.prefs.subStyle, box = E && E.cues; if (!box) return;
    const base = Math.max(18, Math.min(46, root.clientWidth * 0.026));
    box.style.fontSize = (base * s.size / 100) + 'px'; box.style.color = s.color;
    box.style.setProperty('--cue-bottom', s.pos + '%');
    box.style.bottom = s.pos + '%';
    box.className = 'cues ' + s.bg;
  }
  async function uploadSub(file) {
    if (!/\.(srt|vtt|ass|ssa|sub)$/i.test(file.name)) { toast('Choose an .srt, .vtt, .ass, .ssa or .sub file.'); return; }
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await LF.api('/api/subtitle-upload/' + m.id, { method: 'POST', body: fd });
      const keep = tracks.filter((x) => x.ext === 'Embedded');
      tracks = r.tracks.map((t) => ({ id: t.id, label: t.label, lang: t.lang, ext: t.ext, url: '/api/subtitle/' + t.id, sub: t.name })).concat(keep);
      const clean = file.name.replace(/[^A-Za-z0-9._ -]/g, '_');
      await selectTrack(tracks.find((x) => x.sub === clean) || tracks[0], true);
      if (menuView) renderMenu();
    } catch (e) { toast(e.message || 'Upload failed.'); }
  }
  function nudgeOffset(dt) {
    subOffset = Math.round((subOffset + dt) * 10) / 10;
    LF.store.set('lf.suboff.' + m.id, subOffset);
    renderCues();
    // Show a brief on-screen indicator so the user sees the current offset
    toast((subOffset === 0 ? 'Subtitle sync reset' : 'Subtitle delay: ' + (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's'), null, 1200);
  }
  function setOffset(val) {
    subOffset = Math.round(val * 10) / 10;
    LF.store.set('lf.suboff.' + m.id, subOffset);
    renderCues();
  }

  /* ---- menus ---- */
  const mi = (label, o) => `<button class="pm-i" type="button" role="menuitemradio" aria-checked="${!!o.on}" data-act="${o.act}"><span class="ck">${o.on ? icon('check') : ''}</span><span class="tx"><span>${esc(label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.tail ? icon('chev').replace('class="ic"', 'class="ic tail"') : ''}</button>`;
  const head = (title, back) => `<div class="pm-h">${back ? `<button type="button" data-act="back" aria-label="Back">${icon('back')}</button>` : ''}<b>${esc(title)}</b><button type="button" data-act="close" aria-label="Close menu">${icon('close')}</button></div>`;
  const step = (label, id, val) => `<div class="pm-step"><span>${label}</span><div class="ctl"><button class="s" type="button" data-act="${id}:-" aria-label="Decrease ${label}">-</button><output>${val}</output><button class="s" type="button" data-act="${id}:+" aria-label="Increase ${label}">+</button></div></div>`;

  function renderMenu(keepFocus) {
    const s = LF.prefs.subStyle, pm = E.pMenu; let h = '';
    if (menuView === 'subs') {
      h = head('Subtitles') + mi('Off', { on: !curTrack, act: 'sub:off' });
      tracks.forEach((t, i) => { h += mi(t.label, { on: curTrack === t, act: 'sub:' + i, sub: t.ext + (t.sub && t.ext !== 'Embedded' ? '  ·  ' + t.sub : '') }); });
      if (!tracks.length) h += '<div class="pm-g" style="text-transform:none;letter-spacing:0;font-size:.9rem;color:#c3c8d4;padding:8px 10px">No subtitle was found for this movie.</div>';
      h += '<div class="pm-g">Add subtitles</div>' + mi('Browse subtitle folder', { act: 'view:browse', tail: 1 }) + mi('Upload from this device', { act: 'sub:upload' }) +
        '<div class="pm-g">Customize</div>' + mi('Appearance and timing', { act: 'view:style', tail: 1, sub: subOffset ? 'Delay ' + (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's' : '' }) +
        mi('Subtitle sync', { act: 'view:sync', tail: 1, sub: subOffset === 0 ? 'No offset' : (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's' });
    } else if (menuView === 'browse') {
      h = head('Subtitle folder', true) + '<input class="pm-search" id="subQ" type="search" placeholder="Search subtitle files" aria-label="Search subtitle files" autocomplete="off"><div id="subList"></div>';
    } else if (menuView === 'sync') {
      const offStr = (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's';
      const presets = [-5, -2, -1, -0.5, 0, 0.5, 1, 2, 5];
      h = head('Subtitle sync', true) +
        `<div class="sync-panel">
          <div class="sync-display">
            <div class="sync-label">Current offset</div>
            <div class="sync-val ${subOffset > 0 ? 'pos' : subOffset < 0 ? 'neg' : ''}" id="syncVal">${offStr}</div>
            <div class="sync-hint">${subOffset === 0 ? 'Subtitles are in sync' : subOffset > 0 ? 'Subtitles appear later' : 'Subtitles appear earlier'}</div>
          </div>
          <div class="sync-presets">
            ${presets.map((p) => `<button class="sync-chip${p === subOffset ? ' on' : ''}" type="button" data-act="setsync:${p}">${p > 0 ? '+' : ''}${p.toFixed(1)}s</button>`).join('')}
          </div>
          <div class="sync-fine">
            <div class="sync-fine-row">
              <button class="sync-nb" type="button" data-act="syncnudge:-1" aria-label="Back 1 second">-1s</button>
              <button class="sync-nb" type="button" data-act="syncnudge:-0.5" aria-label="Back 0.5 seconds">-0.5s</button>
              <button class="sync-nb lg" type="button" data-act="syncnudge:-0.1" aria-label="Back 0.1 seconds">-0.1s</button>
              <button class="sync-nb lg" type="button" data-act="syncnudge:0.1" aria-label="Forward 0.1 seconds">+0.1s</button>
              <button class="sync-nb" type="button" data-act="syncnudge:0.5" aria-label="Forward 0.5 seconds">+0.5s</button>
              <button class="sync-nb" type="button" data-act="syncnudge:1" aria-label="Forward 1 second">+1s</button>
            </div>
            <div class="sync-tip">Use [ and ] keys to nudge ±0.5s while watching</div>
          </div>
          <button class="sync-reset" type="button" data-act="syncreset">Reset offset to 0</button>
        </div>`;
    } else if (menuView === 'style') {
      h = head('Appearance and timing', true) + step('Size', 'size', s.size + '%') + step('Position', 'pos', s.pos + '%') +
        step('Delay', 'delay', (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's') +
        `<div class="pm-step"><span>Color</span><div class="swatches" role="radiogroup" aria-label="Subtitle color">${COLORS.map((c) => `<button class="swatch" type="button" role="radio" aria-checked="${s.color === c[0]}" aria-label="${c[1]}" data-act="color:${c[0]}" style="background:${c[0]}"></button>`).join('')}</div></div>` +
        '<div class="pm-g">Background</div>' + [['outline', 'Outline only'], ['box', 'Dark box'], ['none', 'None']].map((b) => mi(b[1], { on: s.bg === b[0], act: 'bg:' + b[0] })).join('') +
        mi('Reset to defaults', { act: 'style:reset' });
    } else if (menuView === 'audio') {
      h = head('Audio');
      ((d && d.probe && d.probe.audio) || []).forEach((a) => {
        h += mi(a.title || langName(a.lang) || 'Track ' + (a.n + 1), { on: a.n === audioN, act: 'audio:' + a.n, sub: [a.codec ? a.codec.toUpperCase() : '', a.ch ? (a.ch === 6 ? '5.1' : a.ch === 2 ? 'Stereo' : a.ch + ' ch') : ''].filter(Boolean).join('  ·  ') });
      });
      h += '<div class="pm-g" style="text-transform:none;letter-spacing:0;font-size:.85rem;padding:8px 10px">Switching audio uses compatibility mode.</div>';
    } else if (menuView === 'set') {
      h = head('Playback') + '<div class="pm-g">Speed</div>' + [0.5, 0.75, 1, 1.25, 1.5, 2].map((x) => mi(x === 1 ? 'Normal' : x + 'x', { on: LF.prefs.speed === x, act: 'speed:' + x })).join('') +
        '<div class="pm-g">Picture</div>' + mi('Fit to screen', { on: LF.prefs.fit !== 'cover', act: 'fit:contain' }) + mi('Fill screen (crop edges)', { on: LF.prefs.fit === 'cover', act: 'fit:cover' }) +
        '<div class="pm-g">Playback mode</div>' + mi('Automatic', { on: LF.prefs.playMode === 'auto', act: 'mode:auto' }) +
        mi('Direct only', { on: LF.prefs.playMode === 'direct', act: 'mode:direct' }) +
        mi('Compatibility (needs ffmpeg)', { on: LF.prefs.playMode === 'compat', act: 'mode:compat', sub: LF.info && LF.info.ffmpeg ? 'Converts on the fly. Fixes most playback issues.' : 'Needs ffmpeg installed on the server' }) +
        `<div class="pm-g">Now playing</div><div style="padding:4px 10px 8px;color:#c3c8d4;font-size:.9rem">${mode === 'compat' ? 'Compatibility mode' : 'Direct'}</div>` +
        '<div class="pm-g">Up next</div>' + mi('Auto-play next in folder', { on: LF.prefs.autoNext, act: 'autonext:toggle' });
    }
    pm.innerHTML = h; pm.hidden = false;
    if (menuView === 'browse') {
      loadSubList('');
      const subQ = $('#subQ');
      if (subQ) subQ.oninput = (e) => { clearTimeout(subSearchT); subSearchT = setTimeout(() => loadSubList(e.target.value), 200); };
    }
    if (!keepFocus) {
      if (menuView === 'browse') { const sq = $('#subQ'); if (sq) sq.focus(); }
      else if (menuView === 'sync') {
        // Focus the active preset chip, or the first nudge button if offset not in presets
        const active = pm.querySelector('.sync-chip.on') || pm.querySelector('.sync-nb');
        if (active) active.focus();
      } else {
        const f = pm.querySelector('[aria-checked="true"]') || pm.querySelector('.pm-i') || pm.querySelector('button');
        if (f) f.focus();
      }
    }
  }
  async function loadSubList(q) {
    const box = $('#subList'); if (!box) return;
    try {
      const list = await LF.api('/api/subtitle-library?q=' + encodeURIComponent(q));
      if (!$('#subList')) return;
      $('#subList').innerHTML = list.length
        ? list.map((x, i) => mi(x.name, { act: 'lib:' + x.id + ':' + i, sub: [x.lang, x.ext].filter(Boolean).join('  ·  ') })).join('')
        : `<div class="pm-g" style="text-transform:none;letter-spacing:0;font-size:.9rem;color:#c3c8d4;padding:10px">${q ? 'No files match that search.' : 'Subtitle folder is empty or not configured. Set it in Settings.'}</div>`;
      $('#subList')._items = list;
    } catch { box.textContent = 'Could not read the subtitle folder.'; }
  }
  function toggleMenu(mv) { if (menuView === mv) closeMenu(); else { menuView = mv; renderMenu(); showUI(true); } }
  function closeMenu() { menuView = ''; E.pMenu.hidden = true; renderCues(); showUI(); }
  function menuBack() {
    if (menuView === 'browse' || menuView === 'style' || menuView === 'sync') { menuView = 'subs'; renderMenu(); }
    else { const prev = menuView; closeMenu(); (prev === 'subs' ? E.bSubs : prev === 'audio' ? E.bAudio : E.bSet).focus(); }
  }
  function onMenuClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, s = LF.prefs.subStyle;
    const redraw = () => { LF.savePrefs(); applySubStyle(); renderCues(); const y = E.pMenu.scrollTop; renderMenu(true); E.pMenu.scrollTop = y; const nb = E.pMenu.querySelector(`[data-act="${a}"]`); if (nb) nb.focus(); };
    if (a === 'close') closeMenu();
    else if (a === 'back') menuBack();
    else if (a === 'sub:off') { selectTrack(null, true); renderMenu(true); const x = E.pMenu.querySelector('[data-act="sub:off"]'); if (x) x.focus(); }
    else if (a === 'sub:upload') E.subFile.click();
    else if (a.startsWith('sub:')) { selectTrack(tracks[+a.slice(4)], true).then(() => { renderMenu(true); const x = E.pMenu.querySelector(`[data-act="${a}"]`); if (x) x.focus(); }); }
    else if (a.startsWith('view:')) { menuView = a.slice(5); renderMenu(); }
    else if (a.startsWith('lib:')) {
      const item = ($('#subList')._items || [])[+a.split(':')[2]];
      if (!item) return;
      const t = { id: item.id, label: item.name.replace(/\.[^.]+$/, ''), lang: item.lang, ext: item.ext, url: '/api/subtitle/' + item.id, sub: item.name };
      tracks.push(t); selectTrack(t, true); menuView = 'subs'; renderMenu();
    }
    else if (a === 'size:+' || a === 'size:-') { s.size = Math.max(50, Math.min(250, s.size + (a.endsWith('+') ? 10 : -10))); redraw(); }
    else if (a === 'pos:+' || a === 'pos:-') { s.pos = Math.max(2, Math.min(40, s.pos + (a.endsWith('+') ? 2 : -2))); redraw(); }
    else if (a === 'delay:+' || a === 'delay:-') { nudgeOffset(a.endsWith('+') ? 0.1 : -0.1); redraw(); }
    else if (a.startsWith('syncnudge:')) {
      const dt = parseFloat(a.slice(10)); nudgeOffset(dt);
      // Live-update the display in-place so focus is never lost (important for TV remote)
      const syncValEl = E.pMenu.querySelector('#syncVal');
      if (syncValEl) {
        const offStr2 = (subOffset > 0 ? '+' : '') + subOffset.toFixed(1) + 's';
        syncValEl.textContent = offStr2;
        syncValEl.className = 'sync-val ' + (subOffset > 0 ? 'pos' : subOffset < 0 ? 'neg' : '');
        const hintEl = syncValEl.nextElementSibling;
        if (hintEl) hintEl.textContent = subOffset === 0 ? 'Subtitles are in sync' : subOffset > 0 ? 'Subtitles appear later' : 'Subtitles appear earlier';
        E.pMenu.querySelectorAll('.sync-chip').forEach((c) => c.classList.toggle('on', parseFloat(c.dataset.act.slice(9)) === subOffset));
      } else { redraw(); }
    }
    else if (a.startsWith('setsync:')) { setOffset(parseFloat(a.slice(8))); redraw(); }
    else if (a === 'syncreset') { setOffset(0); redraw(); }
    else if (a.startsWith('color:')) { s.color = a.slice(6); redraw(); }
    else if (a.startsWith('bg:')) { s.bg = a.slice(3); redraw(); }
    else if (a === 'style:reset') { LF.prefs.subStyle = { size: 100, color: '#ffffff', bg: 'outline', pos: 8 }; subOffset = 0; LF.store.set('lf.suboff.' + m.id, 0); redraw(); }
    else if (a.startsWith('audio:')) {
      const n = +a.slice(6);
      if (n !== audioN) {
        if (!(LF.info && LF.info.ffmpeg)) { toast('Switching audio tracks needs ffmpeg on the server.'); return; }
        audioN = n; mode = 'compat'; loadSource(now()); toast('Audio track changed.');
      }
      closeMenu(); E.bAudio.focus();
    }
    else if (a.startsWith('speed:')) { LF.prefs.speed = +a.slice(6); v.playbackRate = LF.prefs.speed; redraw(); }
    else if (a.startsWith('fit:')) { LF.prefs.fit = a.slice(4); root.classList.toggle('fill', LF.prefs.fit === 'cover'); redraw(); }
    else if (a.startsWith('mode:')) {
      LF.prefs.playMode = a.slice(5); LF.savePrefs();
      const want = LF.prefs.playMode === 'compat' ? 'compat' : LF.prefs.playMode === 'direct' ? 'direct' : chooseMode();
      if (want !== mode && !(want === 'compat' && !(LF.info && LF.info.ffmpeg))) { mode = want; loadSource(now()); }
      redraw();
    }
    else if (a === 'autonext:toggle') { LF.prefs.autoNext = !LF.prefs.autoNext; redraw(); }
  }

  /* ---- keyboard / remote ---- */
  P.onKey = function (e) {
    const k = e.key, tgt = e.target, tag = tgt.tagName;
    const typing = (tag === 'INPUT' && !/range|checkbox|button/.test(tgt.type)) || tag === 'TEXTAREA';
    const inMenu = !!(tgt.closest && tgt.closest('.pmenu'));
    if (typing) {
      if (k === 'Escape') { e.preventDefault(); menuView ? menuBack() : tgt.blur(); return true; }
      if (k === 'ArrowDown') { e.preventDefault(); const f = E.pMenu.querySelector('.pm-i'); if (f) f.focus(); return true; }
      return true;
    }
    if (k === 'Escape' || k === 'GoBack' || k === 'BrowserBack' || k === 'Backspace') {
      e.preventDefault();
      if (!E.pErr.hidden) { P.close(); return true; }
      if (!E.endCard.hidden) { clearTimeout(endTimer); E.endCard.hidden = true; return true; }
      if (menuView) menuBack(); else P.close();
      return true;
    }
    showUI();
    if (menuView && (inMenu || /^Arrow/.test(k))) {
      const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[k];
      if (dir) {
        e.preventDefault();
        if (!inMenu) { const f = E.pMenu.querySelector('.pm-i,button'); if (f) f.focus(); return true; }
        LF.moveFocus(dir, E.pMenu); return true;
      }
    }
    if (k === 'k' || k === ' ' || k === 'MediaPlayPause' || k === 'Enter') { e.preventDefault(); togglePlay(); return true; }
    if (k === 'ArrowRight') { e.preventDefault(); skip(inMenu ? 0 : 10); return true; }
    if (k === 'ArrowLeft') { e.preventDefault(); skip(inMenu ? 0 : -10); return true; }
    if (k === 'ArrowUp') { e.preventDefault(); if (!inMenu) { v.volume = Math.min(1, v.volume + 0.1); v.muted = false; } else LF.moveFocus('up', E.pMenu); return true; }
    if (k === 'ArrowDown') { e.preventDefault(); if (!inMenu) { v.volume = Math.max(0, v.volume - 0.1); } else LF.moveFocus('down', E.pMenu); return true; }
    if (k === 'm' || k === 'M') { v.muted = !v.muted; return true; }
    if (k === 'f' || k === 'F') { toggleFS(); return true; }
    if (k === 'c' || k === 'C') {
      if (curTrack) { selectTrack(null, true); }
      else if (tracks.length) { selectTrack(tracks[0], true); }
      return true;
    }
    if (k === '[' || k === '{') { e.preventDefault(); nudgeOffset(-0.5); return true; }
    if (k === ']' || k === '}') { e.preventDefault(); nudgeOffset(0.5); return true; }
    if (k === 'n' || k === 'N') { goNext(); return true; }
    if (k === 'Home') { e.preventDefault(); seekTo(0); return true; }
    if (k === 'End') { e.preventDefault(); seekTo(total() - 5); return true; }
    if (k === 'PageDown') { e.preventDefault(); skip(-300); return true; }
    if (k === 'PageUp') { e.preventDefault(); skip(300); return true; }
    return false;
  };
})();
