/*
 * Salon: ekran startowy dla telewizorów Samsung (moduł TizenBrew).
 * ES5 bez bibliotek, żeby działał płynnie na telewizorze z 2019 roku.
 *
 * Na komputerze: otwórz index.html w Chrome. Strzałki = pilot, Enter = OK,
 * przytrzymaj Enter = opcje, Esc albo Backspace = Wróć.
 */
(function () {
  'use strict';

  var CFG = window.SALON_CONFIG || {};
  var VERSION = '1.2.0';
  var SERVICE = 'http://127.0.0.1:' + (CFG.servicePort || 8097);
  var PREVIEW = location.protocol === 'file:' || /[?&]preview\b/.test(location.search) ||
    !(location.hostname === '127.0.0.1' || location.hostname === 'localhost');

  var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13,
    BACK: 10009, ESC: 27, BKSP: 8, RED: 403, R: 82, S: 83
  };

  var KIND = {
    fav: { w: 304, gap: 32 },
    recent: { w: 232, gap: 28 },
    video: { w: 384, gap: 32 },
    action: { w: 300, gap: 24 }
  };
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var PAD = 112;
  var OFFLINE_MSG = 'Brak połączenia z usługą Salonu. Uruchom telewizor ponownie.';

  /* ---------- Pomocnicze ---------- */

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function each(list, fn) {
    for (var i = 0; i < list.length; i++) { fn(list[i], i); }
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return new Date().getTime(); }
  function noop() {}

  var store = {
    get: function (k, d) {
      try {
        var v = window.localStorage.getItem('salon.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      try { window.localStorage.setItem('salon.' + k, JSON.stringify(v)); } catch (e) { /* pełna pamięć */ }
    }
  };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż+]/g, '');
  }

  function plural(n, one, few, many) {
    n = Math.abs(n);
    if (n === 1) { return one; }
    var d = n % 10;
    var h = n % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) { return few; }
    return many;
  }

  function ago(t) {
    var s = Math.max(0, (now() - t) / 1000);
    if (s < 90) { return 'przed chwilą'; }
    var m = Math.round(s / 60);
    if (m < 60) { return m + ' min temu'; }
    var h = Math.round(m / 60);
    if (h < 24) { return h + ' godz. temu'; }
    var d = Math.round(h / 24);
    if (d === 1) { return 'wczoraj'; }
    if (d < 30) { return d + ' dni temu'; }
    var mo = Math.round(d / 30);
    return mo + ' ' + plural(mo, 'miesiąc', 'miesiące', 'miesięcy') + ' temu';
  }

  function oneDecimal(x) {
    var r = Math.round(x * 10) / 10;
    return String(r).replace('.', ',');
  }

  function views(n) {
    n = Number(n) || 0;
    if (n >= 1e9) { return oneDecimal(n / 1e9) + ' mld wyświetleń'; }
    if (n >= 1e6) { return oneDecimal(n / 1e6) + ' mln wyświetleń'; }
    if (n >= 1e3) { return Math.round(n / 1e3) + ' tys. wyświetleń'; }
    return n + ' ' + plural(n, 'wyświetlenie', 'wyświetlenia', 'wyświetleń');
  }

  function duration(iso) {
    var m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
    if (!m) { return ''; }
    var h = Number(m[1] || 0);
    var mi = Number(m[2] || 0);
    var s = Number(m[3] || 0);
    if (!h && !mi && !s) { return ''; }
    function two(x) { return (x < 10 ? '0' : '') + x; }
    return h ? h + ':' + two(mi) + ':' + two(s) : mi + ':' + two(s);
  }

  var DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca',
    'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

  /* ---------- Kolory ---------- */

  var PALETTE = [
    [141, 124, 255], [86, 140, 255], [38, 182, 168], [228, 92, 160],
    [240, 150, 64], [64, 182, 224], [170, 102, 232], [96, 184, 112]
  ];

  function hashAccent(name) {
    var h = 0;
    var s = String(name || '');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return PALETTE[h % PALETTE.length];
  }

  function toHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) { h = (g - b) / d + (g < b ? 6 : 0); }
      else if (mx === g) { h = (b - r) / d + 2; }
      else { h = (r - g) / d + 4; }
      h /= 6;
    }
    return [h, s, l];
  }

  function toRgb(hsl) {
    var h = hsl[0], s = hsl[1], l = hsl[2];
    function f(p, q, t) {
      if (t < 0) { t += 1; }
      if (t > 1) { t -= 1; }
      if (t < 1 / 6) { return p + (q - p) * 6 * t; }
      if (t < 1 / 2) { return q; }
      if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
      return p;
    }
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }

  function sampleAccent(img) {
    try {
      var c = document.createElement('canvas');
      c.width = 24;
      c.height = 24;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0, 24, 24);
      var d = x.getImageData(0, 0, 24, 24).data;
      var r = 0, g = 0, b = 0, w = 0;
      for (var i = 0; i < d.length; i += 4) {
        var a = d[i + 3] / 255;
        if (a < 0.5) { continue; }
        var R = d[i], Gr = d[i + 1], B = d[i + 2];
        var mx = Math.max(R, Gr, B), mn = Math.min(R, Gr, B);
        var sat = mx ? (mx - mn) / mx : 0;
        var wt = a * (0.08 + sat * sat) * (mx / 255 > 0.15 ? 1 : 0.15);
        r += R * wt;
        g += Gr * wt;
        b += B * wt;
        w += wt;
      }
      if (w <= 0) { return null; }
      var hsl = toHsl([r / w, g / w, b / w]);
      if (hsl[1] < 0.18) { return null; }
      hsl[1] = Math.max(hsl[1], 0.5);
      hsl[2] = clamp(hsl[2], 0.46, 0.6);
      return toRgb(hsl);
    } catch (e) {
      return null;
    }
  }

  function radial(rgb, alpha) {
    var c = rgb.join(',');
    return 'radial-gradient(closest-side, rgba(' + c + ',' + (alpha || 0.55) + '), rgba(' + c + ',0))';
  }

  function paintFace(face, glow, rgb) {
    var c = rgb.join(',');
    face.style.background = 'linear-gradient(140deg, rgba(' + c + ',0.62) 0%, rgba(' + c + ',0.18) 100%), #1B1F46';
    if (glow) { glow.style.background = radial(rgb); }
  }

  /* ---------- Ikony (własne, proste kształty) ---------- */

  function svg(body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  var ICON = {
    pad: svg('<path d="M7.5 8.5h9a4.5 4.5 0 0 1 4.4 3.6l.9 4.4a2.6 2.6 0 0 1-4.6 2.1L15.6 16H8.4l-1.6 2.6a2.6 2.6 0 0 1-4.6-2.1l.9-4.4A4.5 4.5 0 0 1 7.5 8.5z"/>' +
      '<path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.6" r=".9" fill="currentColor"/><circle cx="17.4" cy="13.4" r=".9" fill="currentColor"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/>' +
      '<rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
    source: svg('<rect x="3" y="4.5" width="18" height="12.5" rx="2.2"/><path d="M8 21h8M12 17v4"/><path d="M8.5 10.8h6.5M12.6 8.3l2.5 2.5-2.5 2.5"/>'),
    sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>'),
    home: svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M10 19v-5h4v5"/>'),
    cube: svg('<path d="M12 3.5l8 4.5v8l-8 4.5-8-4.5V8z"/><path d="M4 8l8 4.5L20 8M12 12.5V21"/>'),
    play: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.6l5.4 3.4-5.4 3.4z" fill="currentColor" stroke="none"/>')
  };

  var WICON = {
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
    moon: svg('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
    partly: svg('<path d="M8.5 3.5v1.6M3.5 8.5h1.6M5 5l1.1 1.1M12 5l-1.1 1.1"/><path d="M6.2 11.2A3.6 3.6 0 0 1 11.6 7"/>' +
      '<path d="M9 19.5h9a3.8 3.8 0 0 0 .5-7.57A5.3 5.3 0 0 0 8.3 13.1 3.3 3.3 0 0 0 9 19.5z"/>'),
    cloud: svg('<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .6-8.56A6 6 0 0 0 6.3 11.2 3.7 3.7 0 0 0 7 18.5z"/>'),
    rain: svg('<path d="M7 15.5h10.2a4.3 4.3 0 0 0 .6-8.56A6 6 0 0 0 6.3 8.2 3.7 3.7 0 0 0 7 15.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>'),
    snow: svg('<path d="M7 15.5h10.2a4.3 4.3 0 0 0 .6-8.56A6 6 0 0 0 6.3 8.2 3.7 3.7 0 0 0 7 15.5z"/>' +
      '<circle cx="8" cy="19.5" r=".8" fill="currentColor"/><circle cx="12" cy="20.5" r=".8" fill="currentColor"/><circle cx="16" cy="19.5" r=".8" fill="currentColor"/>'),
    storm: svg('<path d="M7 15.5h10.2a4.3 4.3 0 0 0 .6-8.56A6 6 0 0 0 6.3 8.2 3.7 3.7 0 0 0 7 15.5z"/><path d="M12.8 16.5l-2 3h3l-2 3"/>'),
    fog: svg('<path d="M4 9h16M6 13h12M4 17h16"/>')
  };

  function glyph(name) {
    var g = el('div', 'glyph');
    g.innerHTML = ICON[name] || '';
    return g;
  }

  function monoText(name) {
    var s = String(name || '?').replace(/^\s+/, '');
    return s.charAt(0).toUpperCase() + (/\+$/.test(s) ? '+' : '');
  }

  /* ---------- Stan ---------- */

  var S = {
    mode: 'starting',
    secret: null,
    hasToken: false,
    remote: 'idle',
    apps: [],
    byId: {},
    fav: store.get('fav', null),
    history: store.get('history', []),
    yt: { state: 'loading', items: [], error: '' },
    hdmi: store.get('hdmi', (CFG.playstation && CFG.playstation.hdmi) || 1),
    acc: store.get('acc', {}),
    moving: null,
    layer: 'main',
    focusItem: null,
    focusTile: null
  };

  function psEnabled() { return !CFG.playstation || CFG.playstation.enabled !== false; }
  function psLabel() { return (CFG.playstation && CFG.playstation.label) || 'Konsola'; }

  var DOM = {};

  /* ---------- Usługa w tle ---------- */

  function getJSON(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          reject(new Error('timeout'));
        }
      }, ms || 4000);
      fetch(url).then(function (r) {
        if (!r.ok) {
          var err = new Error('HTTP ' + r.status);
          err.status = r.status;
          throw err;
        }
        return r.json();
      }).then(function (j) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(j);
        }
      }, function (e) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(e);
        }
      });
    });
  }

  function call(path, params, ms) {
    var q = [];
    var p = params || {};
    if (S.secret) { p.s = S.secret; }
    for (var k in p) {
      if (Object.prototype.hasOwnProperty.call(p, k)) {
        q.push(encodeURIComponent(k) + '=' + encodeURIComponent(p[k]));
      }
    }
    return getJSON(SERVICE + path + (q.length ? '?' + q.join('&') : ''), ms);
  }

  function iconUrl(id) { return SERVICE + '/icon?id=' + encodeURIComponent(id); }

  /* ---------- Aplikacje, ulubione, historia ---------- */

  function setApps(list) {
    S.apps = list || [];
    S.byId = {};
    each(S.apps, function (a) { S.byId[a.id] = a; });
    if ((!S.fav || !store.get('favInit', false)) && S.apps.length) { initFavorites(); }
  }

  function findApp(name) {
    var n = norm(name);
    var i;
    if (!n) { return null; }
    for (i = 0; i < S.apps.length; i++) { if (norm(S.apps[i].name) === n) { return S.apps[i]; } }
    for (i = 0; i < S.apps.length; i++) { if (norm(S.apps[i].name).indexOf(n) === 0) { return S.apps[i]; } }
    return null;
  }

  function initFavorites() {
    var out = [];
    if (psEnabled()) { out.push('hdmi'); }
    each(CFG.favorites || [], function (w) {
      var a = findApp(w);
      if (a && out.indexOf('app:' + a.id) < 0) { out.push('app:' + a.id); }
    });
    S.fav = out;
    store.set('fav', out);
    store.set('favInit', true);
  }

  function favList() { return S.fav || (psEnabled() ? ['hdmi'] : []); }
  function favKeyOf(it) { return it.type === 'hdmi' ? 'hdmi' : 'app:' + it.id; }
  function isFav(key) { return favList().indexOf(key) >= 0; }

  function addFav(key, title) {
    var list = favList().slice();
    if (list.indexOf(key) < 0) { list.push(key); }
    S.fav = list;
    store.set('fav', list);
    store.set('favInit', true);
    toast('Dodano do ulubionych: ' + title);
    refreshRows();
  }

  function removeFav(key, title) {
    var list = [];
    each(favList(), function (k) { if (k !== key) { list.push(k); } });
    S.fav = list;
    store.set('fav', list);
    store.set('favInit', true);
    toast('Usunięto z ulubionych: ' + title);
    refreshRows();
  }

  function pushHistory(k) {
    var h = [{ k: k, t: now() }];
    each(S.history, function (x) { if (x.k !== k) { h.push(x); } });
    if (h.length > 24) { h.length = 24; }
    S.history = h;
    store.set('history', h);
  }

  function removeHistory(k, title) {
    var h = [];
    each(S.history, function (x) { if (x.k !== k) { h.push(x); } });
    S.history = h;
    store.set('history', h);
    toast('Usunięto z ostatnio używanych: ' + title);
    refreshRows();
  }

  function lastUsed(k) {
    for (var i = 0; i < S.history.length; i++) { if (S.history[i].k === k) { return S.history[i].t; } }
    return 0;
  }

  function mergeRecent(list) {
    var changed = false;
    each(list || [], function (r) {
      var k = 'app:' + r.id;
      var found = false;
      each(S.history, function (x) {
        if (x.k === k) {
          found = true;
          if (r.t > x.t) {
            x.t = r.t;
            changed = true;
          }
        }
      });
      if (!found) {
        S.history.push({ k: k, t: r.t });
        changed = true;
      }
    });
    if (changed) {
      S.history.sort(function (a, b) { return b.t - a.t; });
      if (S.history.length > 24) { S.history.length = 24; }
      store.set('history', S.history);
    }
  }

  /* ---------- Elementy rzędów ---------- */

  function appItem(a, ctx) {
    return { key: 'app:' + a.id, type: 'app', id: a.id, title: a.name, icon: a.icon, ctx: ctx };
  }

  function hdmiItem(ctx) {
    return { key: 'hdmi', type: 'hdmi', title: psLabel(), ctx: ctx };
  }

  function favItems() {
    var out = [];
    each(favList(), function (k) {
      if (k === 'hdmi') {
        if (psEnabled()) { out.push(hdmiItem('fav')); }
        return;
      }
      var a = S.byId[k.slice(4)];
      if (a) { out.push(appItem(a, 'fav')); }
    });
    out.push({
      key: 'add',
      type: 'add',
      title: 'Dodaj aplikację',
      sub: 'Wybierz ją z listy wszystkich aplikacji na telewizorze.'
    });
    return out;
  }

  function recentItems() {
    var out = [];
    var seen = {};
    for (var i = 0; i < S.history.length && out.length < 12; i++) {
      var h = S.history[i];
      if (seen[h.k]) { continue; }
      seen[h.k] = true;
      var it = null;
      if (h.k === 'hdmi') {
        if (psEnabled()) { it = hdmiItem('recent'); }
      } else {
        var a = S.byId[h.k.slice(4)];
        if (a) { it = appItem(a, 'recent'); }
      }
      if (it) {
        it.key = 'rec:' + h.k;
        it.t = h.t;
        out.push(it);
      }
    }
    return out;
  }

  function ytItems() {
    if ((S.yt.state === 'ok' || S.yt.state === 'demo') && S.yt.items.length) { return S.yt.items; }
    if (S.yt.state === 'nokey') {
      return [{
        key: 'yt-setup',
        type: 'info',
        title: 'Filmy z YouTube',
        face: 'Jak włączyć filmy',
        sub: 'Wpisz klucz YouTube w pliku config.js, a w tym rzędzie pojawią się popularne filmy.',
        hint: 'Instrukcja jest w README, w sekcji „Filmy z YouTube”.'
      }];
    }
    if (S.yt.state === 'error') {
      return [{
        key: 'yt-error',
        type: 'info',
        title: 'YouTube nie odpowiada',
        face: 'Spróbuj ponownie',
        sub: S.yt.error,
        hint: 'OK pobiera filmy jeszcze raz.'
      }];
    }
    return [];
  }

  function actionItems() {
    var out = [];
    if (psEnabled()) {
      out.push({ key: 'act:hdmi', type: 'action', act: 'hdmi', glyph: 'pad', title: psLabel(), sub: 'Przełącza telewizor na HDMI ' + S.hdmi + '.' });
    }
    out.push({ key: 'act:apps', type: 'action', act: 'apps', glyph: 'grid', title: 'Aplikacje', sub: 'Wszystkie aplikacje zainstalowane na telewizorze.' });
    out.push({ key: 'act:source', type: 'action', act: 'key', tvKey: 'KEY_SOURCE', glyph: 'source', title: 'Źródła', sub: 'Lista wejść telewizora: HDMI, USB i antena.' });
    out.push({ key: 'act:menu', type: 'action', act: 'key', tvKey: 'KEY_MENU', glyph: 'sliders', title: 'Ustawienia', sub: 'Ustawienia telewizora, w tym obraz i dźwięk.' });
    out.push({ key: 'act:home', type: 'action', act: 'key', tvKey: 'KEY_HOME', glyph: 'home', title: 'Smart Hub', sub: 'Pasek aplikacji Samsunga.' });
    out.push({ key: 'act:brew', type: 'action', act: 'brew', glyph: 'cube', title: 'TizenBrew', sub: 'Wraca do listy modułów TizenBrew, na przykład TizenTube.' });
    return out;
  }

  function buildRowData() {
    var rows = [{ id: 'fav', label: 'Ulubione', kind: 'fav', items: favItems() }];
    var rec = recentItems();
    if (rec.length) { rows.push({ id: 'recent', label: 'Ostatnio używane', kind: 'recent', items: rec }); }
    var yt = ytItems();
    if (yt.length) { rows.push({ id: 'yt', label: 'Popularne na YouTube', kind: 'video', items: yt }); }
    rows.push({ id: 'actions', label: 'Skróty', kind: 'action', items: actionItems() });
    return rows;
  }

  function itemAccent(it) {
    if (it.type === 'app') { return S.acc[it.id] || hashAccent(it.title); }
    if (it.type === 'hdmi' || it.act === 'hdmi') { return [92, 108, 255]; }
    if (it.type === 'video' || it.type === 'info') { return [224, 70, 78]; }
    return [141, 124, 255];
  }

  /* ---------- Kafelki ---------- */

  function addIcon(face, glow, it) {
    if (it.icon && S.mode === 'online') {
      var img = new Image();
      img.className = 'icon';
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (S.acc[it.id]) { return; }
        S.acc[it.id] = sampleAccent(img) || hashAccent(it.title);
        store.set('acc', S.acc);
        paintFace(face, glow, S.acc[it.id]);
        if (S.focusItem && S.focusItem.id === it.id) { setAmbient(S.acc[it.id]); }
      };
      img.onerror = function () {
        if (img.parentNode) { img.parentNode.removeChild(img); }
        face.appendChild(el('div', 'mono', monoText(it.title)));
      };
      img.src = iconUrl(it.id);
      face.appendChild(img);
    } else {
      face.appendChild(el('div', 'mono', monoText(it.title)));
    }
  }

  function makeTile(it, kind) {
    var t = el('div', 'tile tile-' + kind);
    var glow = el('div', 'glow');
    var face = el('div', 'face');
    var ring = el('div', 'ring');
    t.appendChild(glow);
    t.appendChild(face);
    t.appendChild(ring);
    var rgb = itemAccent(it);

    if (it.type === 'app') {
      paintFace(face, glow, rgb);
      addIcon(face, glow, it);
    } else if (it.type === 'hdmi') {
      paintFace(face, glow, rgb);
      face.appendChild(glyph('pad'));
      if (kind === 'fav') { face.appendChild(el('div', 'port', 'HDMI ' + S.hdmi)); }
    } else if (it.type === 'add') {
      face.className += ' add';
      glow.style.background = radial(rgb);
      face.appendChild(glyph('plus'));
    } else if (it.type === 'video') {
      glow.style.background = radial(rgb);
      if (it.thumb) {
        var im = el('img', 'thumb');
        im.src = it.thumb;
        face.appendChild(im);
      } else {
        var demo = el('div', 'thumb-demo');
        demo.style.background = 'linear-gradient(135deg, hsl(' + it.hue + ',55%,42%) 0%, hsl(' + ((it.hue + 50) % 360) + ',60%,22%) 100%)';
        face.appendChild(demo);
      }
      if (it.live) { face.appendChild(el('div', 'badge live', 'Na żywo')); }
      else if (it.duration) { face.appendChild(el('div', 'badge', it.duration)); }
    } else if (it.type === 'info') {
      face.className += ' info';
      glow.style.background = radial(rgb);
      face.appendChild(glyph('play'));
      face.appendChild(el('div', 'info-face', it.face));
    } else if (it.type === 'action') {
      glow.style.background = radial(rgb, 0.4);
      face.appendChild(glyph(it.glyph));
      face.appendChild(el('div', 'act-label', it.title));
    }

    if (kind === 'recent') { t.appendChild(el('div', 'cap', it.t ? ago(it.t) : '')); }
    if (kind === 'all') { t.appendChild(el('div', 'cap', it.title)); }
    if (kind === 'video') {
      t.appendChild(el('div', 'vt', it.title));
      t.appendChild(el('div', 'vc', it.channel || ''));
    }
    return t;
  }

  /* ---------- Rzędy i nawigacja ---------- */

  var R = [];
  var F = { r: 0 };

  function visibleCount(kind) {
    var k = KIND[kind];
    return Math.max(1, Math.floor((STAGE_W - 2 * PAD + k.gap) / (k.w + k.gap)));
  }

  function fixOffset(r) {
    if (r.idx < r.off) { r.off = r.idx; }
    else if (r.idx > r.off + r.vis - 1) { r.off = r.idx - r.vis + 1; }
    r.off = clamp(r.off, 0, Math.max(0, r.tiles.length - r.vis));
  }

  function applyTrack(r, animate) {
    var x = -r.off * r.step;
    if (!animate) { r.track.className = 'track instant'; }
    r.track.style.webkitTransform = 'translate3d(' + x + 'px,0,0)';
    r.track.style.transform = 'translate3d(' + x + 'px,0,0)';
    if (!animate) {
      void r.track.offsetWidth;
      r.track.className = 'track';
    }
  }

  function indexOfKey(items, key) {
    for (var i = 0; i < items.length; i++) { if (items[i].key === key) { return i; } }
    return -1;
  }

  function renderRows(preserve) {
    var prev = {};
    var keepRow = null;
    if (preserve) {
      each(R, function (r) {
        var it = r.data.items[r.idx];
        prev[r.data.id] = { idx: r.idx, off: r.off, key: it ? it.key : null };
      });
      if (R[F.r]) { keepRow = R[F.r].data.id; }
    }

    DOM.rowsInner.innerHTML = '';
    R = [];
    S.focusTile = null;

    each(buildRowData(), function (d) {
      var kd = KIND[d.kind];
      var rowEl = el('section', 'row row-' + d.kind);
      rowEl.appendChild(el('h2', 'row-label', d.label));
      var track = el('div', 'track');
      var tiles = [];
      each(d.items, function (it) {
        var t = makeTile(it, d.kind);
        track.appendChild(t);
        tiles.push(t);
      });
      rowEl.appendChild(track);
      DOM.rowsInner.appendChild(rowEl);
      var r = { data: d, el: rowEl, track: track, tiles: tiles, idx: 0, off: 0, step: kd.w + kd.gap, vis: visibleCount(d.kind), top: 0 };
      var ps = prev[d.id];
      if (ps) {
        var ni = ps.key ? indexOfKey(d.items, ps.key) : -1;
        r.idx = ni >= 0 ? ni : clamp(ps.idx, 0, Math.max(0, d.items.length - 1));
        r.off = ps.off;
      }
      fixOffset(r);
      applyTrack(r, false);
      R.push(r);
    });

    each(R, function (r) { r.top = r.el.offsetTop; });

    var nr = 0;
    if (keepRow) {
      each(R, function (r, i) { if (r.data.id === keepRow) { nr = i; } });
    }
    F.r = clamp(nr, 0, R.length - 1);
    if (S.layer === 'main') { focus(false); }
  }

  function refreshRows() {
    if (S.layer === 'main') { renderRows(true); } else { S.dirty = true; }
  }

  var lastNav = 0;
  var ambTimer = null;

  function focus(animate) {
    var r = R[F.r];
    each(R, function (row, i) {
      row.el.className = 'row row-' + row.data.kind + (i === F.r ? ' active' : '') + (i < F.r ? ' past' : '');
    });
    if (S.focusTile) { S.focusTile.classList.remove('focused'); }
    if (!r || !r.tiles.length) { return; }
    var t = r.tiles[r.idx];
    t.classList.add('focused');
    S.focusTile = t;
    var y = -r.top;
    DOM.rowsInner.style.webkitTransform = 'translate3d(0,' + y + 'px,0)';
    DOM.rowsInner.style.transform = 'translate3d(0,' + y + 'px,0)';
    var it = r.data.items[r.idx];
    S.focusItem = it;
    parallax((PAD + (r.idx - r.off) * r.step + KIND[r.data.kind].w / 2) / STAGE_W, F.r);
    updateHero(it, animate !== false && now() - lastNav > 140);
    clearTimeout(ambTimer);
    ambTimer = setTimeout(function () { setAmbient(itemAccent(it)); }, 90);
  }

  function focusedItem() {
    var r = R[F.r];
    return r ? r.data.items[r.idx] : null;
  }

  function bump() {
    var t = S.focusTile;
    if (!t) { return; }
    t.style.webkitTransform = 'scale(1.05)';
    t.style.transform = 'scale(1.05)';
    setTimeout(function () {
      t.style.webkitTransform = '';
      t.style.transform = '';
    }, 110);
  }

  function moveH(d) {
    var r = R[F.r];
    if (!r) { return; }
    if (S.moving) { moveFav(d); return; }
    var ni = clamp(r.idx + d, 0, r.tiles.length - 1);
    if (ni === r.idx) { bump(); return; }
    r.idx = ni;
    fixOffset(r);
    applyTrack(r, true);
    focus(true);
  }

  function moveV(d) {
    if (S.moving) { return; }
    var cur = R[F.r];
    var nr = F.r + d;
    while (nr >= 0 && nr < R.length && !R[nr].tiles.length) { nr += d; }
    if (nr < 0 || nr >= R.length) { bump(); return; }
    var x = (cur.idx - cur.off) * cur.step;
    var r = R[nr];
    r.idx = clamp(r.off + Math.round(x / r.step), 0, r.tiles.length - 1);
    fixOffset(r);
    applyTrack(r, true);
    F.r = nr;
    focus(true);
  }

  /* ---------- Duży opis u góry ---------- */

  function heroSub(it) {
    if (it.type === 'app') {
      var t = lastUsed('app:' + it.id);
      if (t) { return 'Ostatnio otwarta ' + ago(t) + '.'; }
      return it.ctx === 'fav' ? 'Jedna z Twoich ulubionych.' : 'Aplikacja na telewizorze.';
    }
    if (it.type === 'hdmi') { return 'Przełącza telewizor na HDMI ' + S.hdmi + '.'; }
    if (it.type === 'video') {
      var parts = [];
      if (it.channel) { parts.push(it.channel); }
      if (it.views) { parts.push(views(it.views)); }
      if (it.published) { parts.push(ago(it.published)); }
      return parts.join(', ');
    }
    return it.sub || '';
  }

  function heroHint(it) {
    if (S.moving) { return 'Strzałkami w lewo i w prawo przesuń kafelek. OK zapisuje kolejność.'; }
    if (it.type === 'app') {
      if (it.ctx === 'fav') { return 'Przytrzymaj OK, aby przesunąć kafelek albo usunąć go z ulubionych.'; }
      return isFav('app:' + it.id) ? 'Przytrzymaj OK, aby zobaczyć opcje.' : 'Przytrzymaj OK, aby dodać do ulubionych.';
    }
    if (it.type === 'hdmi') { return 'Przytrzymaj OK, aby wybrać inny port HDMI.'; }
    if (it.type === 'video') { return 'OK otwiera film w aplikacji YouTube.'; }
    if (it.type === 'add') { return 'OK otwiera listę aplikacji.'; }
    return it.hint || '';
  }

  function heroVisual(it) {
    var box = DOM.heroVisual;
    box.innerHTML = '';
    var rgb = itemAccent(it);
    if (it.type === 'video') {
      var th = el('div', 'hv-thumb');
      if (it.thumbHi || it.thumb) {
        var im = el('img');
        im.src = it.thumbHi || it.thumb;
        th.appendChild(im);
      } else {
        th.style.background = 'linear-gradient(135deg, hsl(' + it.hue + ',55%,42%) 0%, hsl(' + ((it.hue + 50) % 360) + ',60%,22%) 100%)';
      }
      box.appendChild(th);
      return;
    }
    var halo = el('div', 'hv-halo');
    halo.style.background = radial(rgb, 0.42);
    box.appendChild(halo);
    var face = el('div', 'hv-face');
    paintFace(face, null, rgb);
    if (it.type === 'app') {
      if (it.icon && S.mode === 'online') {
        var img = el('img');
        img.crossOrigin = 'anonymous';
        img.onerror = function () {
          if (img.parentNode) { img.parentNode.removeChild(img); }
          face.appendChild(el('div', 'mono', monoText(it.title)));
        };
        img.src = iconUrl(it.id);
        face.appendChild(img);
      } else {
        face.appendChild(el('div', 'mono', monoText(it.title)));
      }
    } else {
      var name = it.type === 'hdmi' ? 'pad' : (it.type === 'add' ? 'plus' : (it.type === 'info' ? 'play' : it.glyph));
      face.innerHTML = ICON[name] || '';
    }
    box.appendChild(face);
  }

  function updateHero(it, animate) {
    DOM.heroTitle.className = 'hero-title' + (it.type === 'video' ? ' long' : '');
    DOM.heroTitle.textContent = it.title || '';
    DOM.heroSub.textContent = heroSub(it);
    DOM.heroHint.textContent = heroHint(it);
    DOM.heroHint.className = 'hero-hint' + (S.moving ? ' moving' : '');
    heroVisual(it);
    if (animate) {
      DOM.heroText.className = 'hero-text';
      void DOM.heroText.offsetWidth;
      DOM.heroText.className = 'hero-text swap';
    }
  }

  /* ---------- Światło w tle ---------- */

  var amb = { on: 'A', key: '' };

  function setAmbient(rgb) {
    var key = rgb.join(',');
    if (key === amb.key) { return; }
    amb.key = key;
    var next = amb.on === 'A' ? DOM.ambB : DOM.ambA;
    var cur = amb.on === 'A' ? DOM.ambA : DOM.ambB;
    next.style.background =
      'radial-gradient(1150px 760px at 80% 10%, rgba(' + key + ',0.40), rgba(' + key + ',0) 70%), ' +
      'radial-gradient(900px 620px at 6% 104%, rgba(' + key + ',0.20), rgba(' + key + ',0) 72%)';
    next.className = 'amb on';
    cur.className = 'amb';
    amb.on = amb.on === 'A' ? 'B' : 'A';
  }

  /* ---------- Działania ---------- */

  var toastTimer = null;

  function toast(msg, ms) {
    DOM.toast.innerHTML = '';
    DOM.toast.appendChild(el('span', null, msg));
    DOM.toast.className = 'toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { DOM.toast.className = 'toast'; }, ms || 3200);
  }

  function launchApp(it) {
    var name = it.title;
    if (S.mode === 'demo') {
      pushHistory('app:' + it.id);
      toast('Podgląd: tu otworzyłaby się aplikacja ' + name + '.');
      refreshRows();
      return;
    }
    if (S.mode !== 'online') { toast(OFFLINE_MSG, 5000); return; }
    toast('Otwieram: ' + name, 2500);
    call('/launch', { id: it.id }, 12000).then(function (r) {
      if (r.ok) { pushHistory('app:' + it.id); }
      else { toast('Nie udało się otworzyć: ' + name + '.', 5000); }
    }, function () {
      toast('Nie udało się otworzyć: ' + name + '.', 5000);
    });
  }

  function remoteError(err) {
    if (/odmówił/i.test(err || '')) {
      return 'Zezwól na dostęp w Ustawienia > Ogólne > Menedżer urządzeń zewnętrznych > Menedżer połączeń urządzeń.';
    }
    if (/zatwierdzono/i.test(err || '')) { return 'Telewizor czekał na zgodę. Spróbuj jeszcze raz i wybierz Zezwól.'; }
    return err ? 'Szczegóły: ' + err : '';
  }

  function sendKey(keyName, label, onDone) {
    if (S.mode === 'demo') {
      toast('Podgląd: telewizor wykonałby polecenie „' + label + '”.');
      if (onDone) { onDone(); }
      return;
    }
    if (S.mode !== 'online') { toast(OFFLINE_MSG, 5000); return; }
    if (!S.hasToken && S.remote !== 'ready') {
      toast('Telewizor zapyta o zgodę dla „Salon”. Wybierz Zezwól.', 9000);
    }
    call('/key', { k: keyName }, 50000).then(function (r) {
      if (r.token) {
        store.set('wstoken', r.token);
        S.hasToken = true;
      }
      if (r.ok) {
        S.remote = 'ready';
        if (onDone) { onDone(); }
      } else {
        toast('Nie udało się: ' + label + '. ' + remoteError(r.error), 7000);
      }
    }, function () {
      toast('Usługa Salonu nie odpowiedziała. Spróbuj jeszcze raz.', 5000);
    });
  }

  function switchHdmi() {
    sendKey('KEY_HDMI' + S.hdmi, psLabel() + ' (HDMI ' + S.hdmi + ')', function () {
      pushHistory('hdmi');
      if (S.mode === 'demo') { refreshRows(); }
    });
  }

  function setHdmi(p) {
    S.hdmi = p;
    store.set('hdmi', p);
    toast(psLabel() + ': HDMI ' + p);
    refreshRows();
  }

  function youTubeApp() { return findApp('YouTube'); }

  function openVideo(it) {
    var yt = youTubeApp();
    if (S.mode === 'demo') {
      if (yt) { pushHistory('app:' + yt.id); }
      toast('Podgląd: ten film otworzyłby się w aplikacji YouTube.');
      refreshRows();
      return;
    }
    if (S.mode !== 'online') { toast(OFFLINE_MSG, 5000); return; }
    toast('Otwieram film w YouTube', 2500);
    call('/youtube', { v: it.vid }, 15000).then(function (r) {
      if (r.ok) {
        if (yt) { pushHistory('app:' + yt.id); }
      } else {
        toast('Nie udało się otworzyć filmu. ' + (r.error ? 'Szczegóły: ' + r.error : ''), 6000);
      }
    }, function () {
      toast('Nie udało się otworzyć filmu.', 5000);
    });
  }

  function runAction(it) {
    if (it.act === 'apps') { openAll(); return; }
    if (it.act === 'hdmi') { switchHdmi(); return; }
    if (it.act === 'key') { sendKey(it.tvKey, it.title); return; }
    if (it.act === 'brew') {
      if (S.mode === 'demo') { toast('Podgląd: tu wróciłbyś do listy modułów TizenBrew.'); return; }
      if (window.history.length > 1) { window.history.back(); }
      else { toast('Uruchom TizenBrew i przytrzymaj strzałkę w górę, zanim otworzy się Salon.', 6000); }
    }
  }

  function activate(it) {
    if (it.type === 'app') { launchApp(it); }
    else if (it.type === 'hdmi') { switchHdmi(); }
    else if (it.type === 'add') { openAll(); }
    else if (it.type === 'video') { openVideo(it); }
    else if (it.type === 'action') { runAction(it); }
    else if (it.key === 'yt-error') { loadYouTube(true); toast('Pobieram filmy z YouTube'); }
    else if (it.type === 'info') { toast(it.hint || it.sub, 5000); }
  }

  /* ---------- Przesuwanie ulubionych ---------- */

  function startMove() {
    var r = R[F.r];
    if (!r || r.data.id !== 'fav') { return; }
    var it = r.data.items[r.idx];
    if (!it || it.type === 'add') { return; }
    S.moving = it.key;
    r.tiles[r.idx].classList.add('moving');
    updateHero(it, false);
  }

  function moveFav(d) {
    var r = R[F.r];
    var i = r.idx;
    var j = i + d;
    if (j < 0 || j >= r.data.items.length) { bump(); return; }
    var a = r.data.items[i];
    var b = r.data.items[j];
    if (b.type === 'add') { bump(); return; }
    var list = favList().slice();
    var ia = list.indexOf(favKeyOf(a));
    var ib = list.indexOf(favKeyOf(b));
    if (ia < 0 || ib < 0) { return; }
    list[ia] = favKeyOf(b);
    list[ib] = favKeyOf(a);
    S.fav = list;
    store.set('fav', list);
    store.set('favInit', true);
    var ta = r.tiles[i];
    var tb = r.tiles[j];
    if (d > 0) { r.track.insertBefore(tb, ta); } else { r.track.insertBefore(ta, tb); }
    r.tiles[i] = tb;
    r.tiles[j] = ta;
    r.data.items[i] = b;
    r.data.items[j] = a;
    r.idx = j;
    fixOffset(r);
    applyTrack(r, true);
    focus(false);
  }

  function endMove() {
    S.moving = null;
    if (S.focusTile) { S.focusTile.classList.remove('moving'); }
    var it = focusedItem();
    if (it) { updateHero(it, false); }
    toast('Zapisano kolejność ulubionych.');
  }

  /* ---------- Lista wszystkich aplikacji ---------- */

  var AO = { items: [], tiles: [], idx: 0, top: 0, cols: 6, rowH: 215 };

  function openAll() {
    S.layer = 'all';
    AO.items = [];
    AO.tiles = [];
    each(S.apps, function (a) { AO.items.push(appItem(a, 'all')); });
    DOM.allGrid.innerHTML = '';
    if (!AO.items.length) {
      DOM.allGrid.appendChild(el('p', 'empty', S.mode === 'online'
        ? 'Telewizor nie przekazał jeszcze listy aplikacji. Zamknij listę przyciskiem Wróć i otwórz ją za chwilę.'
        : OFFLINE_MSG));
    }
    each(AO.items, function (it) {
      var t = makeTile(it, 'all');
      DOM.allGrid.appendChild(t);
      AO.tiles.push(t);
    });
    var n = AO.items.length;
    DOM.allHint.textContent = n
      ? n + ' ' + plural(n, 'aplikacja', 'aplikacje', 'aplikacji') + '. OK otwiera, przytrzymanie OK dodaje do ulubionych.'
      : '';
    AO.idx = clamp(AO.idx, 0, Math.max(0, n - 1));
    AO.top = 0;
    DOM.allApps.className = 'overlay open';
    if (AO.tiles.length) { AO.rowH = AO.tiles[0].offsetHeight + 40; }
    focusAll();
  }

  function focusAll() {
    each(AO.tiles, function (t, i) {
      if (i === AO.idx) { t.classList.add('focused'); } else { t.classList.remove('focused'); }
    });
    var row = Math.floor(AO.idx / AO.cols);
    if (row < AO.top) { AO.top = row; }
    else if (row > AO.top + 2) { AO.top = row - 2; }
    var y = -AO.top * AO.rowH;
    DOM.allGrid.style.webkitTransform = 'translate3d(0,' + y + 'px,0)';
    DOM.allGrid.style.transform = 'translate3d(0,' + y + 'px,0)';
    var it = AO.items[AO.idx];
    if (it) { setAmbient(itemAccent(it)); }
  }

  function allMove(k) {
    var n = AO.items.length;
    if (!n) { return; }
    var i = AO.idx;
    var c = AO.cols;
    if (k === K.LEFT && i % c > 0) { i--; }
    else if (k === K.RIGHT && i % c < c - 1 && i + 1 < n) { i++; }
    else if (k === K.UP && i - c >= 0) { i -= c; }
    else if (k === K.DOWN) {
      if (i + c < n) { i += c; }
      else if (Math.floor(i / c) < Math.floor((n - 1) / c)) { i = n - 1; }
    }
    AO.idx = i;
    focusAll();
  }

  function closeAll() {
    DOM.allApps.className = 'overlay';
    S.layer = 'main';
    if (S.dirty) {
      S.dirty = false;
      renderRows(true);
    } else {
      amb.key = '';
      focus(false);
    }
  }

  /* ---------- Menu opcji (przytrzymanie OK) ---------- */

  var MN = { opts: [], idx: 0, back: 'main' };

  function menuFor(it, rowId) {
    var o = [];
    if (it.type === 'app') {
      o.push({ label: 'Otwórz', run: function () { launchApp(it); } });
      var key = 'app:' + it.id;
      if (isFav(key)) {
        if (rowId === 'fav') { o.push({ label: 'Przesuń', run: startMove }); }
        o.push({ label: 'Usuń z ulubionych', run: function () { removeFav(key, it.title); } });
      } else {
        o.push({ label: 'Dodaj do ulubionych', run: function () { addFav(key, it.title); } });
      }
      if (rowId === 'recent') {
        o.push({ label: 'Usuń z ostatnio używanych', run: function () { removeHistory(key, it.title); } });
      }
    } else if (it.type === 'hdmi') {
      o.push({ label: 'Przełącz na HDMI ' + S.hdmi, run: switchHdmi });
      each([1, 2, 3, 4], function (p) {
        if (p !== S.hdmi) { o.push({ label: 'Konsola jest na HDMI ' + p, run: function () { setHdmi(p); } }); }
      });
      if (rowId === 'fav') {
        o.push({ label: 'Przesuń', run: startMove });
        o.push({ label: 'Usuń z ulubionych', run: function () { removeFav('hdmi', it.title); } });
      } else if (!isFav('hdmi')) {
        o.push({ label: 'Dodaj do ulubionych', run: function () { addFav('hdmi', it.title); } });
      }
      if (rowId === 'recent') {
        o.push({ label: 'Usuń z ostatnio używanych', run: function () { removeHistory('hdmi', it.title); } });
      }
    } else if (it.type === 'video') {
      o.push({ label: 'Otwórz w YouTube', run: function () { openVideo(it); } });
      o.push({ label: 'Pobierz nowe filmy', run: function () { loadYouTube(true); toast('Pobieram filmy z YouTube'); } });
    } else if (it.act === 'hdmi') {
      return menuFor(hdmiItem('actions'), 'actions');
    }
    return o;
  }

  function openMenu(it, rowId) {
    var opts = menuFor(it, rowId);
    if (!opts.length) { return; }
    MN.opts = opts;
    MN.idx = 0;
    MN.back = S.layer;
    S.layer = 'menu';
    DOM.menuTitle.textContent = it.title;
    DOM.menuList.innerHTML = '';
    each(opts, function (o) { DOM.menuList.appendChild(el('div', 'opt', o.label)); });
    DOM.menu.className = 'overlay open';
    var h = DOM.menuPanel.offsetHeight;
    DOM.menuPanel.style.top = Math.round((STAGE_H - h) / 2) + 'px';
    menuFocus();
  }

  function menuFocus() {
    each(DOM.menuList.childNodes, function (n, i) {
      n.className = 'opt' + (i === MN.idx ? ' focused' : '');
    });
  }

  function closeMenu() {
    DOM.menu.className = 'overlay';
    S.layer = MN.back;
    if (S.layer === 'all') { focusAll(); }
    else if (S.dirty) {
      S.dirty = false;
      renderRows(true);
    } else {
      focus(false);
    }
  }

  function menuSelect() {
    var o = MN.opts[MN.idx];
    closeMenu();
    if (o) { o.run(); }
  }

  function openMenuForFocus() {
    if (S.layer === 'all') {
      var a = AO.items[AO.idx];
      if (a) { openMenu(a, 'all'); }
      return;
    }
    var it = focusedItem();
    var r = R[F.r];
    if (it && r) { openMenu(it, r.data.id); }
  }

  /* ---------- Pilot ---------- */

  var ok = { down: false, last: 0, timer: null, long: false };

  function press() {
    if (S.layer === 'menu') { menuSelect(); return; }
    if (S.layer === 'all') {
      var a = AO.items[AO.idx];
      if (a) {
        closeAll();
        launchApp(a);
      }
      return;
    }
    if (S.moving) { endMove(); return; }
    var it = focusedItem();
    if (it) { activate(it); }
  }

  function longPress() {
    if (S.layer === 'menu') { menuSelect(); return; }
    if (S.moving) { endMove(); return; }
    openMenuForFocus();
  }

  function back() {
    if (S.layer === 'menu') { closeMenu(); return; }
    if (S.layer === 'all') { closeAll(); return; }
    if (S.moving) { endMove(); return; }
    var first = R[0];
    if (F.r !== 0 || (first && first.idx !== 0)) {
      F.r = 0;
      if (first) {
        first.idx = 0;
        fixOffset(first);
        applyTrack(first, true);
      }
      focus(true);
    }
  }

  function nav(k) {
    if (S.layer === 'menu') {
      if (k === K.UP) { MN.idx = clamp(MN.idx - 1, 0, MN.opts.length - 1); }
      else if (k === K.DOWN) { MN.idx = clamp(MN.idx + 1, 0, MN.opts.length - 1); }
      menuFocus();
      return;
    }
    if (S.layer === 'all') { allMove(k); return; }
    if (k === K.LEFT) { moveH(-1); }
    else if (k === K.RIGHT) { moveH(1); }
    else if (k === K.UP) { moveV(-1); }
    else { moveV(1); }
  }

  function onKeyDown(e) {
    var k = e.keyCode;
    var n = now();
    SV.last = n;
    if (SV.on) {
      e.preventDefault();
      stopSaver();
      return;
    }
    if (S.mode === 'demo' && k === K.S) {
      e.preventDefault();
      startSaver();
      return;
    }
    if (k === K.OK) {
      e.preventDefault();
      if (e.repeat || ((ok.down || ok.long) && n - ok.last < 700)) {
        ok.last = n;
        return;
      }
      ok.down = true;
      ok.long = false;
      ok.last = n;
      clearTimeout(ok.timer);
      ok.timer = setTimeout(function () {
        if (ok.down) {
          ok.down = false;
          ok.long = true;
          longPress();
        }
      }, 600);
      return;
    }
    if (k === K.LEFT || k === K.RIGHT || k === K.UP || k === K.DOWN) {
      e.preventDefault();
      if (n - lastNav < 70) { return; }
      nav(k);
      lastNav = n;
      return;
    }
    if (k === K.BACK || k === K.ESC || k === K.BKSP) {
      e.preventDefault();
      back();
      return;
    }
    if (k === K.RED || (S.mode === 'demo' && k === K.R)) {
      e.preventDefault();
      if (S.layer !== 'menu') { openMenuForFocus(); }
    }
  }

  function onKeyUp(e) {
    if (e.keyCode !== K.OK) { return; }
    e.preventDefault();
    clearTimeout(ok.timer);
    var wasDown = ok.down;
    ok.down = false;
    ok.long = false;
    if (wasDown) { press(); }
  }

  /* ---------- Tło ---------- */

  var sceneDay = -1;
  var PARA = [[24, 6], [40, 12], [60, 18], [84, 24]];

  function buildWaves(sc) {
    sc.innerHTML = '';
    DOM.waves = [];
    sc.appendChild(el('div', 'sky'));
    for (var i = 1; i <= 4; i++) {
      var w = el('div', 'wave w' + i);
      w.appendChild(el('div', 'wv'));
      sc.appendChild(w);
      DOM.waves.push(w);
    }
  }

  // Fale przesuwają się lekko za kafelkiem: bliższe warstwy bardziej, dalsze mniej.
  function parallax(nx, row) {
    if (!DOM.waves || !DOM.waves.length || CFG.animateBackground === false) { return; }
    var rr = Math.min(row, 3);
    for (var i = 0; i < DOM.waves.length; i++) {
      var dx = Math.round(-(nx - 0.5) * PARA[i][0]);
      var dy = -rr * PARA[i][1];
      var t = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      DOM.waves[i].style.webkitTransform = t;
      DOM.waves[i].style.transform = t;
    }
  }

  function applyScene() {
    var d = new Date();
    var day = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
    if (day === sceneDay) { return; }
    sceneDay = day;
    var list = CFG.wallpapers || [];
    var sc = DOM.scene;
    if (list.length) {
      var src = String(list[day % list.length]).replace(/["\\()]/g, '');
      sc.innerHTML = '';
      DOM.waves = [];
      sc.className = 'wall';
      sc.style.backgroundImage = 'url("' + src + '")';
      return;
    }
    sc.style.backgroundImage = '';
    if (/^g[lł]adkie$/i.test(CFG.background || '')) {
      sc.innerHTML = '';
      DOM.waves = [];
      sc.className = '';
      return;
    }
    if (!DOM.waves || !DOM.waves.length) { buildWaves(sc); }
    sc.className = 'fale' + (CFG.animateBackground === false ? ' still' : '');
  }

  /* ---------- Wygaszacz „Wieczór w salonie” ---------- */

  var SAVER_COLORS = [[141, 124, 255], [86, 140, 255], [38, 182, 168], [228, 92, 160], [240, 150, 64]];
  var SV = { on: false, last: now(), timers: [], color: 0, hintTimer: null };

  function saverMinutes() {
    var m = Number(CFG.screensaverMinutes);
    return isNaN(m) ? 3 : m;
  }

  function saverClock() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    DOM.svClock.textContent = h + ':' + (m < 10 ? '0' : '') + m;
    DOM.svDate.textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function renderSaver() {
    saverClock();
    DOM.svNow.innerHTML = '';
    DOM.svDays.innerHTML = '';
    var wx = S.wx;
    if (!wx) { return; }
    var w = wmo(wx.code, wx.isDay);
    DOM.svNow.innerHTML = WICON[w.icon] || '';
    DOM.svNow.appendChild(el('span', 'w-temp', wx.temp + '°'));
    DOM.svNow.appendChild(el('span', 'w-desc', (w.text ? w.text + ', ' : '') + wx.place));
    each(wx.days, function (dd) {
      var box = el('div', 'sv-day');
      box.appendChild(el('div', 'sv-dname', dd.name));
      var ic = el('div', 'sv-dicon');
      ic.innerHTML = WICON[wmo(dd.code, 1).icon] || '';
      box.appendChild(ic);
      var t = el('div', 'sv-dtemp');
      t.appendChild(el('span', 'hi', dd.max + '°'));
      t.appendChild(el('span', 'lo', ' / ' + dd.min + '°'));
      box.appendChild(t);
      DOM.svDays.appendChild(box);
    });
  }

  function saverPlace() {
    var bw = DOM.svBox.offsetWidth || 820;
    var bh = DOM.svBox.offsetHeight || 560;
    var x = 150 + Math.round(Math.random() * Math.max(0, STAGE_W - 300 - bw));
    var y = 110 + Math.round(Math.random() * Math.max(0, STAGE_H - 220 - bh));
    DOM.svBox.style.left = x + 'px';
    DOM.svBox.style.top = y + 'px';
  }

  function saverMove() {
    DOM.svBox.className = 'sv-box fade';
    setTimeout(function () {
      if (!SV.on) { return; }
      saverPlace();
      DOM.svBox.className = 'sv-box';
    }, 1300);
  }

  function saverColor() {
    SV.color = (SV.color + 1) % SAVER_COLORS.length;
    setAmbient(SAVER_COLORS[SV.color]);
  }

  function startSaver() {
    if (SV.on) { return; }
    SV.on = true;
    renderSaver();
    DOM.svBox.className = 'sv-box';
    document.body.classList.add('saver');
    saverPlace();
    parallax(0.5, 0);
    DOM.svHint.className = 'sv-hint show';
    clearTimeout(SV.hintTimer);
    SV.hintTimer = setTimeout(function () { DOM.svHint.className = 'sv-hint'; }, 8000);
    saverColor();
    SV.timers.push(setInterval(saverColor, 14000));
    SV.timers.push(setInterval(saverMove, 55000));
  }

  function stopSaver() {
    if (!SV.on) { return; }
    SV.on = false;
    each(SV.timers, function (t) { clearInterval(t); });
    SV.timers = [];
    clearTimeout(SV.hintTimer);
    document.body.classList.remove('saver');
    amb.key = '';
    if (S.layer === 'all') { focusAll(); }
    else if (S.layer === 'main') { focus(false); }
    else if (S.focusItem) { setAmbient(itemAccent(S.focusItem)); }
  }

  function idleCheck() {
    var mins = saverMinutes();
    if (mins <= 0 || SV.on || document.hidden) { return; }
    if (now() - SV.last >= mins * 60000) { startSaver(); }
  }

  /* ---------- Zegar, pogoda ---------- */

  function tick() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    DOM.clock.textContent = h + ':' + (m < 10 ? '0' : '') + m;
    DOM.date.textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    var hello = (h >= 5 && h < 18) ? 'Dzień dobry' : 'Dobry wieczór';
    DOM.greet.textContent = hello + (CFG.name ? ', ' + CFG.name : '');
    applyScene();
    if (SV.on) { saverClock(); }
  }

  function wmo(code, day) {
    var c = Number(code);
    if (c === 0) { return { icon: day ? 'sun' : 'moon', text: 'Bezchmurnie' }; }
    if (c === 1 || c === 2) { return { icon: day ? 'partly' : 'cloud', text: 'Częściowe zachmurzenie' }; }
    if (c === 3) { return { icon: 'cloud', text: 'Pochmurno' }; }
    if (c === 45 || c === 48) { return { icon: 'fog', text: 'Mgła' }; }
    if (c >= 51 && c <= 57) { return { icon: 'rain', text: 'Mżawka' }; }
    if (c >= 61 && c <= 67) { return { icon: 'rain', text: 'Deszcz' }; }
    if (c >= 71 && c <= 77) { return { icon: 'snow', text: 'Śnieg' }; }
    if (c >= 80 && c <= 82) { return { icon: 'rain', text: 'Przelotny deszcz' }; }
    if (c === 85 || c === 86) { return { icon: 'snow', text: 'Przelotny śnieg' }; }
    if (c >= 95) { return { icon: 'storm', text: 'Burza' }; }
    return { icon: 'cloud', text: '' };
  }

  function renderWeather(temp, code, day, place) {
    var w = wmo(code, day);
    var box = DOM.weather;
    box.innerHTML = WICON[w.icon] || '';
    box.appendChild(el('span', 'w-temp', temp + '°'));
    box.appendChild(el('span', 'w-desc', (w.text ? w.text + ', ' : '') + place));
  }

  function loadWeather() {
    var city = CFG.city;
    if (!city) {
      DOM.weather.innerHTML = '';
      return;
    }
    var geo = store.get('geo', null);
    var p = (geo && geo.q === city) ? Promise.resolve(geo) :
      getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=pl&format=json&name=' + encodeURIComponent(city), 8000)
        .then(function (r) {
          var g = r && r.results && r.results[0];
          if (!g) { throw new Error('city'); }
          var c = { q: city, lat: g.latitude, lon: g.longitude, name: g.name || city };
          store.set('geo', c);
          return c;
        });
    p.then(function (g) {
      return getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + g.lat + '&longitude=' + g.lon +
        '&current=temperature_2m,weather_code,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto', 8000).then(function (w) {
        var c = w && w.current;
        if (!c) { throw new Error('weather'); }
        var dl = w.daily || {};
        var times = dl.time || [];
        var codes = dl.weather_code || [];
        var maxs = dl.temperature_2m_max || [];
        var mins = dl.temperature_2m_min || [];
        var days = [];
        for (var i = 1; i < 4 && i < times.length; i++) {
          var p = String(times[i]).split('-');
          var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
          days.push({ name: DAYS[dt.getDay()], code: codes[i], max: Math.round(maxs[i]), min: Math.round(mins[i]) });
        }
        S.wx = { temp: Math.round(c.temperature_2m), code: c.weather_code, isDay: c.is_day, place: g.name, days: days };
        renderWeather(S.wx.temp, c.weather_code, c.is_day, g.name);
        if (SV.on) { renderSaver(); }
      });
    }).then(null, noop);
  }

  /* ---------- YouTube ---------- */

  var DEMO_VIDEOS = (function () {
    var titles = [
      'Tu pojawią się popularne filmy z YouTube',
      'Każdy kafelek pokazuje miniaturę, tytuł i kanał',
      'OK otwiera film od razu w aplikacji YouTube',
      'Wpisz klucz w config.js, a zobaczysz prawdziwe filmy',
      'Lista odświeża się sama co pół godziny',
      'Przytrzymanie OK pozwala pobrać nowe filmy'
    ];
    var out = [];
    each(titles, function (t, i) {
      out.push({
        key: 'yt:demo' + i,
        type: 'video',
        vid: 'demo' + i,
        title: t,
        channel: 'Podgląd',
        views: [1240000, 356000, 98000, 2100000, 47000, 650000][i],
        published: now() - (i + 1) * 9 * 3600 * 1000,
        duration: ['12:04', '8:31', '23:17', '4:52', '1:02:45', '16:20'][i],
        hue: [258, 205, 330, 18, 168, 280][i],
        thumb: null
      });
    });
    return out;
  })();

  function mapVideo(v) {
    if (!v || !v.id || !v.snippet) { return null; }
    var sn = v.snippet;
    var th = sn.thumbnails || {};
    var small = th.medium || th.high || th['default'] || {};
    var big = th.maxres || th.standard || th.high || th.medium || {};
    return {
      key: 'yt:' + v.id,
      type: 'video',
      vid: v.id,
      title: (sn.localized && sn.localized.title) || sn.title || '',
      channel: sn.channelTitle || '',
      views: v.statistics ? Number(v.statistics.viewCount || 0) : 0,
      published: sn.publishedAt ? Date.parse(sn.publishedAt) : 0,
      duration: duration(v.contentDetails && v.contentDetails.duration),
      live: sn.liveBroadcastContent === 'live',
      thumb: small.url || null,
      thumbHi: big.url || null
    };
  }

  function loadYouTube(force) {
    var key = CFG.youtubeApiKey;
    if (!key) {
      S.yt = PREVIEW ? { state: 'demo', items: DEMO_VIDEOS } : { state: 'nokey', items: [] };
      return;
    }
    var cache = store.get('yt', null);
    if (cache && cache.items && cache.items.length) {
      S.yt = { state: 'ok', items: cache.items };
      if (!force && now() - cache.t < 30 * 60 * 1000) {
        refreshRows();
        return;
      }
    }
    var url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics' +
      '&chart=mostPopular&maxResults=16&hl=pl&regionCode=' + encodeURIComponent(CFG.youtubeRegion || 'PL') +
      '&key=' + encodeURIComponent(key);
    getJSON(url, 10000).then(function (r) {
      var items = [];
      each(r.items || [], function (v) {
        var m = mapVideo(v);
        if (m) { items.push(m); }
      });
      if (!items.length) { throw new Error('empty'); }
      store.set('yt', { t: now(), items: items });
      S.yt = { state: 'ok', items: items };
      refreshRows();
    }).then(null, function (e) {
      if (S.yt.state === 'ok') { return; }
      var msg = (e && (e.status === 400 || e.status === 403))
        ? 'YouTube odrzucił klucz. Sprawdź youtubeApiKey w config.js.'
        : 'Brak połączenia z YouTube. Sprawdź internet w telewizorze.';
      S.yt = { state: 'error', items: [], error: msg };
      refreshRows();
    });
  }

  /* ---------- Start ---------- */

  var DEMO_APPS = (function () {
    var names = ['YouTube', 'Netflix', 'Crunchyroll', 'Disney+', 'Prime Video', 'Max', 'Spotify',
      'Twitch', 'Apple TV', 'Player', 'SkyShowtime', 'Polsat Box Go', 'Internet', 'Galeria'];
    var out = [];
    each(names, function (n) { out.push({ id: 'demo.' + norm(n), name: n, icon: false }); });
    return out;
  })();

  function setStatus() {
    var s = DOM.status;
    if (S.mode === 'demo') {
      s.textContent = 'Podgląd na komputerze. Aplikacje i filmy są przykładowe.';
      s.className = 'status show';
    } else if (S.mode === 'offline') {
      s.textContent = OFFLINE_MSG;
      s.className = 'status show';
    } else {
      s.className = 'status';
    }
  }

  var revealed = false;

  function reveal() {
    if (revealed) { return; }
    revealed = true;
    renderRows(true);
    document.body.classList.add('ready');
    setTimeout(function () { document.body.classList.add('settled'); }, 1200);
  }

  function goDemo() {
    S.mode = 'demo';
    setApps(DEMO_APPS);
    if (!S.history.length) {
      S.history = [
        { k: 'app:demo.netflix', t: now() - 2 * 3600 * 1000 },
        { k: 'hdmi', t: now() - 20 * 3600 * 1000 },
        { k: 'app:demo.crunchyroll', t: now() - 3 * 86400 * 1000 },
        { k: 'app:demo.youtube', t: now() - 4 * 86400 * 1000 }
      ];
    }
    setStatus();
    if (revealed) { refreshRows(); } else { reveal(); }
  }

  function loadApps() {
    return call('/apps', null, 10000).then(function (r) {
      if (r.ok && r.apps && r.apps.length) {
        setApps(r.apps);
        store.set('apps', r.apps);
      }
      return call('/recent', null, 4000).then(function (rr) {
        if (rr.ok) { mergeRecent(rr.recent); }
      }, noop);
    }, noop).then(function () {
      if (revealed) { refreshRows(); } else { reveal(); }
    });
  }

  function connect(attempt) {
    call('/status', null, 2500).then(function (st) {
      S.mode = 'online';
      S.secret = st.secret || null;
      S.hasToken = !!st.hasToken;
      S.remote = st.remote || 'idle';
      setStatus();
      var tok = store.get('wstoken', null);
      if (tok && !st.hasToken) {
        call('/token', { v: tok }, 3000).then(function () { S.hasToken = true; }, noop);
      }
      loadApps();
    }, function () {
      if (PREVIEW) { goDemo(); return; }
      if (attempt < 10) {
        setTimeout(function () { connect(attempt + 1); }, 1500);
        return;
      }
      S.mode = 'offline';
      setStatus();
      reveal();
      setTimeout(function () { connect(0); }, 30000);
    });
  }

  function fit() {
    var w = window.innerWidth || STAGE_W;
    var h = window.innerHeight || STAGE_H;
    var s = Math.min(w / STAGE_W, h / STAGE_H);
    var st = DOM.stage.style;
    st.webkitTransform = 'scale(' + s + ')';
    st.transform = 'scale(' + s + ')';
    st.left = Math.round((w - STAGE_W * s) / 2) + 'px';
    st.top = Math.round((h - STAGE_H * s) / 2) + 'px';
  }

  function init() {
    each(['stage', 'scene', 'ambA', 'ambB', 'greet', 'date', 'status', 'clock', 'weather', 'heroText', 'heroTitle',
      'heroSub', 'heroHint', 'heroVisual', 'rowsInner', 'allApps', 'allHint', 'allGrid', 'menu',
      'menuTitle', 'menuList', 'toast', 'svBox', 'svClock', 'svDate', 'svNow', 'svDays', 'svHint'], function (id) { DOM[id] = $(id); });
    DOM.menuPanel = DOM.menu.firstElementChild || DOM.menu.children[0];

    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { return; }
      SV.last = now();
      stopSaver();
      tick();
      if (S.mode === 'online') {
        call('/recent', null, 4000).then(function (rr) {
          if (rr.ok) { mergeRecent(rr.recent); }
          refreshRows();
        }, refreshRows);
      } else {
        refreshRows();
      }
    });

    tick();
    setInterval(tick, 10000);
    setInterval(idleCheck, 5000);

    if (!PREVIEW) {
      var cached = store.get('apps', null);
      if (cached && cached.length) { setApps(cached); }
    }
    loadYouTube(false);
    renderRows(false);
    setAmbient(itemAccent(focusedItem() || { type: 'add' }));
    setTimeout(reveal, 1800);

    connect(0);
    loadWeather();
    setInterval(loadWeather, 20 * 60 * 1000);
    setInterval(function () { loadYouTube(true); }, 30 * 60 * 1000);
    setInterval(function () { if (S.mode === 'online') { loadApps(); } }, 15 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
