/*
 * Salon: usługa w tle (TizenBrew "serviceFile").
 *
 * TizenBrew uruchamia ten plik w swoim procesie Node.js (stary Node ~4.x),
 * dlatego kod jest w ES5 i korzysta wyłącznie z modułów wbudowanych.
 *
 * Strona modułu nie ma dostępu do API "tizen", a ta usługa ma. Strona
 * rozmawia z nią przez http://127.0.0.1:8097 (tylko z tego telewizora).
 *
 *   GET /status            stan usługi
 *   GET /apps              zainstalowane aplikacje
 *   GET /recent            aplikacje uruchamiane ostatnio (także spoza Salonu)
 *   GET /icon?id=...       ikona aplikacji
 *   GET /launch?id=...     otwiera aplikację
 *   GET /youtube?v=...     otwiera film w aplikacji YouTube
 *   GET /key?k=KEY_HDMI1   wysyła klawisz pilota (HDMI, Źródła, Ustawienia, Home)
 *   GET /token?v=...       przywraca zapisany token pilota sieciowego
 */
(function () {
  'use strict';

  var VERSION = '1.1.0';
  var PORT = 8097;
  var REMOTE_NAME = 'Salon';

  var G = (typeof global !== 'undefined') ? global : {};
  var REQ = null;
  if (typeof require === 'function') {
    REQ = require;
  } else if (G.process && G.process.mainModule) {
    REQ = function (m) { return G.process.mainModule.require(m); };
  }
  if (!REQ) { return; }

  var http = REQ('http');
  var net = REQ('net');
  var tls = REQ('tls');
  var crypto = REQ('crypto');
  var fs = REQ('fs');
  var urlMod = REQ('url');

  function log() {
    try {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[Salon ' + VERSION + ']');
      console.log.apply(console, a);
    } catch (e) { /* brak konsoli */ }
  }

  function emsg(e) {
    if (!e) { return ''; }
    return String(e.message || e.name || e);
  }

  function T() {
    try { if (typeof tizen !== 'undefined' && tizen) { return tizen; } } catch (e) { /* brak */ }
    return G.tizen || null;
  }

  /* ---------- Jedna kopia usługi naraz ---------- */

  var prev = G.__salonTvService;
  if (prev && prev.version === VERSION && prev.alive) {
    log('ta sama wersja już działa');
    return;
  }
  if (prev && typeof prev.stop === 'function') {
    try { prev.stop(); } catch (e) { /* stara kopia już nie działa */ }
  }
  var self = { version: VERSION, alive: true, stop: null };
  G.__salonTvService = self;

  var SECRET = crypto.randomBytes(12).toString('hex');
  var ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
  var APP_ID_RE = /^[A-Za-z0-9._\-]{2,120}$/;
  var VIDEO_RE = /^[A-Za-z0-9_\-]{6,20}$/;
  var KEY_RE = /^KEY_(HDMI[1-4]?|SOURCE|MENU|HOME|TV)$/;
  var TOKEN_RE = /^[A-Za-z0-9]{2,64}$/;

  /* ---------- Aplikacje ---------- */

  var appsCache = null;
  var appsAt = 0;
  var iconPaths = {};
  var pkgOf = {};
  var visible = {};

  function listApps(cb) {
    if (appsCache && Date.now() - appsAt < 60000) { cb(null, appsCache); return; }
    var t = T();
    if (!t || !t.application || !t.application.getAppsInfo) {
      cb(new Error('Usługa nie ma dostępu do API telewizora'), null);
      return;
    }
    var finished = false;
    function fin(err, list) {
      if (finished) { return; }
      finished = true;
      cb(err, list);
    }
    setTimeout(function () { fin(new Error('Telewizor nie podał listy aplikacji'), null); }, 8000);
    try {
      t.application.getAppsInfo(function (infos) {
        var out = [];
        var seen = {};
        var icons = {};
        var pkgs = {};
        var vis = {};
        for (var i = 0; i < infos.length; i++) {
          var a = infos[i];
          if (!a || !a.id || a.show === false) { continue; }
          var name = String(a.name || '').replace(/\s+/g, ' ').trim();
          if (!name || seen[a.id]) { continue; }
          seen[a.id] = true;
          vis[a.id] = true;
          if (a.iconPath) { icons[a.id] = String(a.iconPath).replace(/^file:\/\//, ''); }
          pkgs[a.id] = String(a.packageId || String(a.id).split('.')[0]);
          out.push({ id: a.id, name: name, icon: true });
        }
        out.sort(function (x, y) {
          var p = x.name.toLowerCase();
          var q = y.name.toLowerCase();
          return p < q ? -1 : (p > q ? 1 : 0);
        });
        appsCache = out;
        appsAt = Date.now();
        iconPaths = icons;
        pkgOf = pkgs;
        visible = vis;
        fin(null, out);
      }, function (e) {
        fin(e || new Error('getAppsInfo'), null);
      });
    } catch (e) {
      fin(e, null);
    }
  }

  function launch(id, cb) {
    var t = T();
    if (!t || !t.application) { cb(new Error('Usługa nie ma dostępu do API telewizora')); return; }
    var finished = false;
    function fin(err, via) {
      if (finished) { return; }
      finished = true;
      cb(err, via);
    }
    setTimeout(function () { fin(new Error('Telewizor nie odpowiedział')); }, 10000);
    try {
      t.application.launch(id, function () { fin(null, 'launch'); }, function (e1) {
        try {
          var ctl = new t.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, null);
          t.application.launchAppControl(ctl, id, function () { fin(null, 'appcontrol'); }, function (e2) {
            fin(e2 || e1 || new Error('Nie udało się otworzyć aplikacji'));
          }, null);
        } catch (e3) {
          fin(e3);
        }
      });
    } catch (e) {
      fin(e);
    }
  }

  function findYouTube() {
    if (!appsCache) { return null; }
    var i;
    for (i = 0; i < appsCache.length; i++) {
      if (/^youtube$/i.test(appsCache[i].name)) { return appsCache[i].id; }
    }
    for (i = 0; i < appsCache.length; i++) {
      var n = appsCache[i].name;
      if (/youtube/i.test(n) && !/kids|music|tv\b/i.test(n)) { return appsCache[i].id; }
    }
    return null;
  }

  function dialYouTube(v, cb) {
    var body = 'v=' + encodeURIComponent(v);
    var finished = false;
    function fin(err) {
      if (finished) { return; }
      finished = true;
      cb(err);
    }
    try {
      var r = http.request({
        host: '127.0.0.1',
        port: 8080,
        method: 'POST',
        path: '/ws/apps/YouTube',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'Origin': 'https://www.youtube.com'
        }
      }, function (res) {
        res.resume();
        fin(res.statusCode >= 200 && res.statusCode < 300 ? null : new Error('DIAL ' + res.statusCode));
      });
      r.on('error', function (e) { fin(e); });
      r.setTimeout(5000, function () {
        try { r.abort(); } catch (e) { /* już zamknięte */ }
        fin(new Error('DIAL nie odpowiada'));
      });
      r.end(body);
    } catch (e) {
      fin(e);
    }
  }

  function openYouTube(v, cb) {
    dialYouTube(v, function (dialErr) {
      if (!dialErr) { cb(null, 'dial'); return; }
      listApps(function () {
        var ytId = findYouTube();
        var t = T();
        if (!ytId || !t || !t.application) { cb(dialErr); return; }
        try {
          var data = [new t.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: 'v=' + v })])];
          var ctl = new t.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null, data);
          t.application.launchAppControl(ctl, ytId, function () { cb(null, 'payload'); }, function () {
            launch(ytId, cb);
          }, null);
        } catch (e) {
          launch(ytId, cb);
        }
      });
    });
  }

  /* ---------- Ostatnio używane (także aplikacje otwarte spoza Salonu) ---------- */

  var recent = [];
  var running = null;

  function noteRecent(id) {
    if (!id || /tizenbrew/i.test(id)) { return; }
    for (var i = recent.length - 1; i >= 0; i--) {
      if (recent[i].id === id) { recent.splice(i, 1); }
    }
    recent.unshift({ id: id, t: Date.now() });
    if (recent.length > 30) { recent.length = 30; }
  }

  function pollRunning() {
    var t = T();
    if (!t || !t.application || !t.application.getAppsContext) { return; }
    try {
      t.application.getAppsContext(function (ctxs) {
        var seen = {};
        for (var i = 0; i < ctxs.length; i++) {
          var id = ctxs[i] && ctxs[i].appId;
          if (!id) { continue; }
          seen[id] = true;
          if (running && !running[id] && visible[id]) { noteRecent(id); }
        }
        running = seen;
      }, function () { /* brak dostępu, pomijamy */ });
    } catch (e) { /* brak dostępu, pomijamy */ }
  }

  /* ---------- Pilot sieciowy telewizora (WebSocket, porty 8002 i 8001) ---------- */

  function wsFrame(data, opcode) {
    var payload = Buffer.isBuffer(data) ? data : new Buffer(String(data), 'utf8');
    var len = payload.length;
    var head = len < 126 ? 2 : (len < 65536 ? 4 : 10);
    var out = new Buffer(head + 4 + len);
    out[0] = 0x80 | (opcode & 0x0f);
    if (len < 126) {
      out[1] = 0x80 | len;
    } else if (len < 65536) {
      out[1] = 0x80 | 126;
      out.writeUInt16BE(len, 2);
    } else {
      out[1] = 0x80 | 127;
      out.writeUInt32BE(Math.floor(len / 4294967296), 2);
      out.writeUInt32BE(len >>> 0, 6);
    }
    var mask = crypto.randomBytes(4);
    mask.copy(out, head);
    for (var i = 0; i < len; i++) {
      out[head + 4 + i] = payload[i] ^ mask[i % 4];
    }
    return out;
  }

  function Remote() {
    this.state = 'idle';
    this.sock = null;
    this.port = null;
    this.token = null;
    this.queue = [];
    this.lastError = null;
  }

  Remote.prototype.key = function (keyName, cb) {
    this.send({
      method: 'ms.remote.control',
      params: { Cmd: 'Click', DataOfCmd: keyName, Option: 'false', TypeOfRemote: 'SendRemoteKey' }
    }, cb);
  };

  Remote.prototype.send = function (obj, cb) {
    var item = { data: JSON.stringify(obj), cb: cb || function () {} };
    if (this.state === 'ready' && this.sock) {
      this._write(item);
      return;
    }
    this.queue.push(item);
    if (this.state !== 'connecting') { this._connect(); }
  };

  Remote.prototype._write = function (item) {
    try {
      this.sock.write(wsFrame(item.data, 1));
      item.cb(null);
    } catch (e) {
      item.cb(e);
    }
  };

  Remote.prototype._flush = function (err) {
    var q = this.queue;
    this.queue = [];
    for (var i = 0; i < q.length; i++) {
      if (err) { q[i].cb(err); } else { this._write(q[i]); }
    }
  };

  Remote.prototype.close = function () {
    if (this.sock) {
      try { this.sock.destroy(); } catch (e) { /* już zamknięte */ }
    }
    this.sock = null;
    this.state = 'closed';
  };

  Remote.prototype._dropped = function (sock) {
    if (this.sock === sock) {
      this.sock = null;
      this.state = 'closed';
    }
  };

  Remote.prototype._connect = function () {
    var me = this;
    var ports = [8002, 8001];
    var i = 0;
    me.state = 'connecting';
    me.lastError = null;
    function next(err) {
      if (err) { me.lastError = err; }
      if (i >= ports.length) {
        me.state = 'failed';
        me._flush(me.lastError || new Error('Brak połączenia z pilotem sieciowym telewizora'));
        return;
      }
      var port = ports[i];
      i++;
      me._attempt(port, function (e, sock) {
        if (e) { next(e); return; }
        me.sock = sock;
        me.port = port;
        me.state = 'ready';
        log('pilot sieciowy połączony, port', port);
        me._flush(null);
      });
    }
    next(null);
  };

  Remote.prototype._attempt = function (port, done) {
    var me = this;
    var secure = (port === 8002);
    var finished = false;
    var handshaken = false;
    var buf = new Buffer(0);
    var fragments = [];
    var authTimer = null;
    var sock = null;

    function finish(err) {
      if (finished) { return; }
      finished = true;
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }
      if (err) {
        try { sock.destroy(); } catch (e) { /* już zamknięte */ }
        done(err);
      } else {
        done(null, sock);
      }
    }

    var name = new Buffer(REMOTE_NAME, 'utf8').toString('base64');
    var path = '/api/v2/channels/samsung.remote.control?name=' + encodeURIComponent(name);
    if (secure && me.token) { path += '&token=' + encodeURIComponent(me.token); }
    var wsKey = crypto.randomBytes(16).toString('base64');

    function onConnect() {
      sock.write(
        'GET ' + path + ' HTTP/1.1\r\n' +
        'Host: 127.0.0.1:' + port + '\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + wsKey + '\r\n' +
        'Sec-WebSocket-Version: 13\r\n' +
        '\r\n'
      );
    }

    function onMessage(text) {
      var m;
      try { m = JSON.parse(text); } catch (e) { return; }
      var ev = m && m.event;
      if (ev === 'ms.channel.connect') {
        if (m.data && m.data.token) { me.token = String(m.data.token); }
        try { sock.setTimeout(0); } catch (e) { /* brak */ }
        finish(null);
      } else if (ev === 'ms.channel.unauthorized') {
        if (secure && me.token) { me.token = null; }
        finish(new Error('Telewizor odmówił dostępu'));
      } else if (ev === 'ms.channel.timeOut') {
        finish(new Error('Nie zatwierdzono dostępu na telewizorze'));
      }
    }

    function parse() {
      while (buf.length >= 2) {
        var b0 = buf[0];
        var b1 = buf[1];
        var fin = (b0 & 0x80) !== 0;
        var op = b0 & 0x0f;
        var masked = (b1 & 0x80) !== 0;
        var len = b1 & 0x7f;
        var off = 2;
        if (len === 126) {
          if (buf.length < 4) { return; }
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buf.length < 10) { return; }
          len = buf.readUInt32BE(2) * 4294967296 + buf.readUInt32BE(6);
          off = 10;
        }
        var mask = null;
        if (masked) {
          if (buf.length < off + 4) { return; }
          mask = buf.slice(off, off + 4);
          off += 4;
        }
        if (buf.length < off + len) { return; }
        var payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        if (mask) {
          var plain = new Buffer(len);
          for (var j = 0; j < len; j++) { plain[j] = payload[j] ^ mask[j % 4]; }
          payload = plain;
        }
        if (op === 0x9) {
          try { sock.write(wsFrame(payload, 0xA)); } catch (e) { /* brak */ }
        } else if (op === 0x8) {
          try { sock.end(); } catch (e) { /* brak */ }
        } else if (op === 0x0 || op === 0x1 || op === 0x2) {
          fragments.push(payload);
          if (fin) {
            var text = Buffer.concat(fragments).toString('utf8');
            fragments = [];
            onMessage(text);
          }
        }
      }
    }

    try {
      if (secure) {
        sock = tls.connect({ host: '127.0.0.1', port: port, rejectUnauthorized: false }, onConnect);
      } else {
        sock = net.connect({ host: '127.0.0.1', port: port }, onConnect);
      }
    } catch (e) {
      finish(e);
      return;
    }

    sock.setTimeout(45000);
    sock.on('timeout', function () {
      if (!finished) { finish(new Error('Telewizor nie odpowiada (port ' + port + ')')); }
    });
    sock.on('error', function (e) {
      if (!finished) { finish(e); } else { me._dropped(sock); }
    });
    sock.on('close', function () {
      if (!finished) { finish(new Error('Połączenie zamknięte (port ' + port + ')')); } else { me._dropped(sock); }
    });
    sock.on('data', function (chunk) {
      buf = Buffer.concat([buf, chunk]);
      if (!handshaken) {
        var str = buf.toString('binary');
        var end = str.indexOf('\r\n\r\n');
        if (end < 0) {
          if (buf.length > 16384) { finish(new Error('Niepoprawna odpowiedź telewizora')); }
          return;
        }
        var head = str.slice(0, end);
        if (!/^HTTP\/1\.[01] 101/.test(head)) {
          finish(new Error('Port ' + port + ': ' + head.split('\r\n')[0]));
          return;
        }
        handshaken = true;
        buf = buf.slice(end + 4);
        authTimer = setTimeout(function () {
          finish(new Error('Nie zatwierdzono dostępu na telewizorze'));
        }, 40000);
      }
      parse();
    });
  };

  var remote = new Remote();

  /* ---------- Serwer HTTP dla strony ---------- */

  function originOk(req) {
    var o = req.headers.origin;
    return !!(o && ORIGIN_RE.test(o));
  }

  function corsHeaders(req, h) {
    var o = req.headers.origin;
    if (o && ORIGIN_RE.test(o)) {
      h['Access-Control-Allow-Origin'] = o;
      h['Vary'] = 'Origin';
    }
    return h;
  }

  function reply(req, res, code, obj) {
    var h = corsHeaders(req, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.writeHead(code, h);
    res.end(JSON.stringify(obj));
  }

  // Ikona z informacji o aplikacji, a gdy jej brak albo nie da się jej odczytać,
  // najlepszy obrazek z folderu zasobów aplikacji (nazwa z "icon" lub "logo" wygrywa).
  var iconFound = {};

  function findIconFile(id, cb) {
    var pkg = pkgOf[id] || String(id).split('.')[0];
    if (!pkg || !/^[A-Za-z0-9_\-]+$/.test(pkg)) { cb(null); return; }
    var dirs = [
      '/opt/usr/globalapps/' + pkg + '/shared/res',
      '/opt/usr/apps/' + pkg + '/shared/res',
      '/opt/usr/globalapps/' + pkg + '/res/wgt',
      '/opt/usr/apps/' + pkg + '/res/wgt',
      '/usr/apps/' + pkg + '/shared/res'
    ];
    var best = null;
    var i = 0;
    function nextDir() {
      if (i >= dirs.length) { cb(best ? best.path : null); return; }
      var dir = dirs[i];
      i++;
      fs.readdir(dir, function (err, names) {
        if (err || !names) { nextDir(); return; }
        var files = names.filter(function (n) { return /\.(png|jpe?g|webp)$/i.test(n); });
        var j = 0;
        function nextFile() {
          if (j >= files.length) { nextDir(); return; }
          var n = files[j];
          j++;
          var p = dir + '/' + n;
          fs.stat(p, function (e, st) {
            if (!e && st && st.isFile() && st.size > 1500 && st.size < 4000000) {
              var score = st.size;
              if (/icon|logo/i.test(n)) { score += 5000000; }
              if (/splash|background|banner|bg[_\-.]/i.test(n)) { score -= 8000000; }
              if (!best || score > best.score) { best = { path: p, score: score }; }
            }
            nextFile();
          });
        }
        nextFile();
      });
    }
    nextDir();
  }

  function serveIcon(req, res, id) {
    function notFound() {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      res.end();
    }
    function send(p, data) {
      var ext = String(p.split('.').pop() || '').toLowerCase();
      var type = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') { type = 'image/jpeg'; }
      else if (ext === 'svg') { type = 'image/svg+xml'; }
      else if (ext === 'webp') { type = 'image/webp'; }
      else if (ext === 'gif') { type = 'image/gif'; }
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    }
    function fallback() {
      if (iconFound[id] === null) { notFound(); return; }
      if (iconFound[id]) {
        fs.readFile(iconFound[id], function (err, data) {
          if (err) { notFound(); } else { send(iconFound[id], data); }
        });
        return;
      }
      findIconFile(id, function (p) {
        iconFound[id] = p || null;
        if (!p) { notFound(); return; }
        fs.readFile(p, function (err, data) {
          if (err) { notFound(); } else { send(p, data); }
        });
      });
    }
    function go() {
      if (!visible[id]) { notFound(); return; }
      var p = iconPaths[id];
      if (!p) { fallback(); return; }
      fs.readFile(p, function (err, data) {
        if (err) { fallback(); } else { send(p, data); }
      });
    }
    if (!APP_ID_RE.test(String(id || ''))) { notFound(); return; }
    if (appsCache) { go(); } else { listApps(function () { go(); }); }
  }

  var server = http.createServer(function (req, res) {
    var u = urlMod.parse(req.url, true);
    var p = u.pathname;
    var q = u.query || {};

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' }));
      res.end();
      return;
    }

    if (p === '/__shutdown') {
      if (!req.headers.origin && req.headers['x-salon-internal']) {
        reply(req, res, 200, { ok: true });
        setTimeout(shutdown, 50);
      } else {
        reply(req, res, 403, { ok: false });
      }
      return;
    }

    if (p === '/status') {
      var st = {
        ok: true,
        version: VERSION,
        tizen: !!T(),
        remote: remote.state,
        remotePort: remote.port,
        hasToken: !!remote.token
      };
      if (originOk(req)) { st.secret = SECRET; }
      reply(req, res, 200, st);
      return;
    }

    if (p === '/icon') { serveIcon(req, res, q.id); return; }

    if (p === '/apps') {
      listApps(function (err, list) {
        if (list) { reply(req, res, 200, { ok: true, apps: list }); }
        else { reply(req, res, 200, { ok: false, error: emsg(err) }); }
      });
      return;
    }

    if (p === '/recent') {
      reply(req, res, 200, { ok: true, recent: recent });
      return;
    }

    // Wszystko niżej coś robi na telewizorze, więc wymaga strony Salonu.
    if (!originOk(req) || q.s !== SECRET) {
      reply(req, res, 403, { ok: false, error: 'Brak dostępu' });
      return;
    }

    if (p === '/launch') {
      if (!APP_ID_RE.test(String(q.id || ''))) { reply(req, res, 400, { ok: false, error: 'Zły identyfikator' }); return; }
      launch(q.id, function (err, via) {
        if (!err) { noteRecent(q.id); }
        reply(req, res, 200, { ok: !err, via: via || null, error: emsg(err) });
      });
      return;
    }

    if (p === '/youtube') {
      if (!VIDEO_RE.test(String(q.v || ''))) { reply(req, res, 400, { ok: false, error: 'Zły film' }); return; }
      openYouTube(q.v, function (err, via) {
        reply(req, res, 200, { ok: !err, via: via || null, error: emsg(err) });
      });
      return;
    }

    if (p === '/key') {
      if (!KEY_RE.test(String(q.k || ''))) { reply(req, res, 400, { ok: false, error: 'Niedozwolony klawisz' }); return; }
      remote.key(q.k, function (err) {
        reply(req, res, 200, { ok: !err, error: emsg(err), token: remote.token || null, port: remote.port });
      });
      return;
    }

    if (p === '/token') {
      if (TOKEN_RE.test(String(q.v || ''))) { remote.token = String(q.v); }
      reply(req, res, 200, { ok: true });
      return;
    }

    reply(req, res, 404, { ok: false, error: 'Nie ma takiej ścieżki' });
  });

  /* ---------- Start, przejęcie portu od starszej wersji, zatrzymanie ---------- */

  var timers = [];

  function startTimers() {
    listApps(function () { pollRunning(); });
    timers.push(setInterval(pollRunning, 15000));
    timers.push(setInterval(function () { appsAt = 0; }, 10 * 60 * 1000));
  }

  function stopTimers() {
    for (var i = 0; i < timers.length; i++) { clearInterval(timers[i]); }
    timers = [];
  }

  function shutdown() {
    self.alive = false;
    stopTimers();
    try { remote.close(); } catch (e) { /* brak */ }
    try { server.close(); } catch (e) { /* brak */ }
    log('zatrzymano');
  }
  self.stop = shutdown;

  function peekVersion(cb) {
    var finished = false;
    function fin(v) {
      if (finished) { return; }
      finished = true;
      cb(v);
    }
    try {
      var r = http.get({ host: '127.0.0.1', port: PORT, path: '/status' }, function (res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (d) { body += d; });
        res.on('end', function () {
          try { fin(JSON.parse(body).version || null); } catch (e) { fin(null); }
        });
      });
      r.on('error', function () { fin(null); });
      r.setTimeout(2000, function () {
        try { r.abort(); } catch (e) { /* brak */ }
        fin(null);
      });
    } catch (e) {
      fin(null);
    }
  }

  function askShutdown(cb) {
    var finished = false;
    function fin() {
      if (finished) { return; }
      finished = true;
      cb();
    }
    try {
      var r = http.get({
        host: '127.0.0.1',
        port: PORT,
        path: '/__shutdown',
        headers: { 'X-Salon-Internal': VERSION }
      }, function (res) {
        res.resume();
        res.on('end', fin);
      });
      r.on('error', fin);
      r.setTimeout(2000, function () {
        try { r.abort(); } catch (e) { /* brak */ }
        fin();
      });
    } catch (e) {
      fin();
    }
  }

  var tries = 0;

  function listen() {
    if (!self.alive) { return; }
    try { server.listen(PORT, '127.0.0.1'); } catch (e) { log('nie można nasłuchiwać:', emsg(e)); }
  }

  server.on('listening', function () {
    log('gotowe, port', PORT);
    startTimers();
  });

  server.on('error', function (e) {
    if (e && e.code === 'EADDRINUSE' && tries < 6) {
      tries++;
      peekVersion(function (ver) {
        if (ver === VERSION) {
          log('ta sama wersja już nasłuchuje, ta kopia kończy pracę');
          self.alive = false;
          return;
        }
        log('przejmuję port od wersji', ver || 'nieznanej');
        askShutdown(function () { setTimeout(listen, 700); });
      });
      return;
    }
    log('błąd serwera:', emsg(e));
  });

  listen();
})();
