// ============================================================
//  NOCHE DE GENIOS · Club GEI
//  Servidor que conecta la consola, el proyector y los celulares.
//
//  /           → consola del conductor (pide PIN)
//  /pantalla   → proyector
//  /jugar      → celular de cada equipo
//  /tarjetas   → tarjetas del tesoro para imprimir (pide PIN)
//
//  La consola es la que lleva el juego: el servidor solo reparte
//  el estado a todos y le pasa a la consola lo que mandan los celulares.
// ============================================================
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');
const qrcode = require('qrcode-generator');

const PORT = process.env.PORT || 3000;
const PIN = process.env.PIN || 'genio2026';
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const SPOTIFY_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const DIR_DATOS = path.join(__dirname, 'datos');
const DIR_FOTOS = path.join(DIR_DATOS, 'fotos');
const DIR_IMAGENES = path.join(DIR_DATOS, 'imagenes');
fs.mkdirSync(DIR_FOTOS, { recursive: true });
fs.mkdirSync(DIR_IMAGENES, { recursive: true });

// ---------- Datos guardados (por si se reinicia el servidor) ----------
function leer(nombre) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR_DATOS, nombre), 'utf8')); } catch (e) { return null; }
}
const timers = {};
function guardar(nombre, datos) {
  clearTimeout(timers[nombre]);
  timers[nombre] = setTimeout(() => {
    fs.writeFile(path.join(DIR_DATOS, nombre), JSON.stringify(datos), () => {});
  }, 500);
}
let ultimoEstado = leer('estado.json');   // lo que ven proyector y celulares
let contenido = leer('contenido.json');   // preguntas, desafíos y tesoro (privado)
let respaldo = leer('respaldo.json');     // estado completo de la consola (privado)

// ---------- Dirección pública para los QR ----------
function ipLocal() {
  const ips = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) if ((i.family === 'IPv4' || i.family === 4) && !i.internal) ips.push(i.address);
  }
  return ips.find(ip => ip.startsWith('192.168.')) || ips.find(ip => ip.startsWith('10.')) || ips[0] || 'localhost';
}
function baseUrl(req) {
  if (BASE_URL) return BASE_URL;
  let host = req.headers.host || ('localhost:' + PORT);
  if (/^(localhost|127\.)/.test(host)) host = ipLocal() + ':' + PORT;
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return proto + '://' + host;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function qrSvg(texto) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

// ---------- Web ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 6e6 });
const pagina = (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'));

app.get(['/', '/pantalla', '/jugar'], pagina);
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.get('/vendor/qrcode.js', (req, res) => res.sendFile(require.resolve('qrcode-generator')));
app.get('/api/info', (req, res) => res.json({ base: baseUrl(req) }));
app.use('/fotos', express.static(DIR_FOTOS, { maxAge: '1d' }));
app.use('/imagenes', express.static(DIR_IMAGENES, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Spotify: la cuenta del organizador, para sumar a la playlist los temas que eligen los jugadores ----------
const sp = { refresh: '', access: '', vence: 0, usuario: '', playlist: null };
const tickets = new Map();   // ticket de un solo uso que la consola pide para conectar Spotify
const estados = new Map();   // "state" del login de Spotify → base para volver
function spEstado() {
  return { configurado: !!(SPOTIFY_ID && SPOTIFY_SECRET), conectado: !!sp.refresh, usuario: sp.usuario, playlist: sp.playlist };
}
function avisarConsola() { io.to('consola').emit('spotifyEstado', spEstado()); }
async function spToken(form) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(SPOTIFY_ID + ':' + SPOTIFY_SECRET).toString('base64') },
    body: new URLSearchParams(form)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || ('HTTP ' + r.status));
  sp.access = d.access_token; sp.vence = Date.now() + (d.expires_in || 3600) * 1000 - 60000;
  if (d.refresh_token && d.refresh_token !== sp.refresh) { sp.refresh = d.refresh_token; io.to('consola').emit('spotifyRefresh', sp.refresh); }
}
async function spAcceso() {
  if (!sp.refresh) throw new Error('Spotify no está conectado.');
  if (!sp.access || Date.now() > sp.vence) await spToken({ grant_type: 'refresh_token', refresh_token: sp.refresh });
  return sp.access;
}
async function spApi(metodo, ruta, cuerpo) {
  const pedir = async () => fetch('https://api.spotify.com/v1' + ruta, {
    method: metodo,
    headers: Object.assign({ Authorization: 'Bearer ' + await spAcceso() }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  let r = await pedir();
  if (r.status === 401) { sp.access = ''; r = await pedir(); }
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((d.error && d.error.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return d;
}
async function spUsuario() { try { const me = await spApi('GET', '/me'); sp.usuario = me.display_name || me.id || ''; } catch (e) { } }

app.get('/spotify/conectar', (req, res) => {
  const t = String(req.query.t || '');
  if (!tickets.has(t)) return res.status(403).send('El enlace venció. Volvé a la consola y tocá "Conectar Spotify" de nuevo.');
  tickets.delete(t);
  if (!SPOTIFY_ID || !SPOTIFY_SECRET) return res.send('Falta configurar SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en el servidor.');
  const state = crypto.randomBytes(12).toString('hex');
  const base = baseUrl(req);
  estados.set(state, base); setTimeout(() => estados.delete(state), 10 * 60000);
  res.redirect('https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: SPOTIFY_ID, state,
    scope: 'playlist-modify-public playlist-modify-private', redirect_uri: base + '/spotify/callback'
  }));
});
app.get('/spotify/callback', async (req, res) => {
  const base = estados.get(String(req.query.state || ''));
  const fin = (titulo, txt) => res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotify</title>
    <body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h2>${esc(titulo)}</h2><p>${esc(txt)}</p></div></body>`);
  if (!base) return fin('No se pudo conectar', 'El pedido venció. Volvé a la consola y probá de nuevo.');
  estados.delete(String(req.query.state));
  if (req.query.error || !req.query.code) return fin('No se conectó Spotify', 'Se canceló el permiso. Podés cerrar esta ventana.');
  try {
    sp.refresh = '';
    await spToken({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: base + '/spotify/callback' });
    await spUsuario();
    avisarConsola();
    fin('✅ Spotify conectado', 'Ya podés cerrar esta ventana y volver a la consola.');
  } catch (e) { fin('No se pudo conectar', String(e.message || e)); }
});

app.get('/tarjetas', (req, res) => {
  if (req.query.pin !== PIN) {
    return res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Tarjetas del tesoro</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh">
      <form><h2>Tarjetas del tesoro</h2><p>Ingresá el PIN de la consola:</p>
      <input name="pin" type="password" style="font-size:18px;padding:8px"> <button style="font-size:18px">Ver</button></form></body>`);
  }
  const base = baseUrl(req);
  const tesoro = (contenido && contenido.tesoro) || [];
  const tarjetas = tesoro.map((q, i) => `
    <div class="t">${qrSvg(base + '/jugar?tesoro=' + encodeURIComponent(q.codigo))}
      <h2>🔎 Tesoro #${i + 1}</h2><div class="cod">${esc(q.codigo)}</div>
      <p>Escaneá el QR con la cámara del celu</p><small>${esc(q.lugar || '')}</small></div>`).join('');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tarjetas del tesoro</title>
  <style>
    body{font-family:'Libre Franklin',system-ui,sans-serif;margin:0;padding:20px;color:#1c232e}
    .g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .t{border:3px dashed #9aa3ad;border-radius:16px;padding:18px;text-align:center;break-inside:avoid;page-break-inside:avoid}
    .t svg{width:62%;height:auto}
    .t h2{margin:6px 0 2px;color:#1f5079}
    .cod{font:900 28px 'Arial Black',sans-serif;letter-spacing:.08em;color:#c9852c}
    .t p{margin:6px 0 2px}.t small{color:#8a929b}
    .u{text-align:center;border:4px solid #1f5079;border-radius:20px;padding:24px;margin-bottom:24px;page-break-after:always}
    .u svg{width:55%;height:auto}.u h1{font-size:40px;margin:0;color:#1f5079}.u p{font-size:22px}
    .barra{margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    @media print{.barra{display:none}}
  </style></head><body>
  <div class="barra"><button onclick="print()" style="font-size:18px;padding:10px 20px">🖨️ Imprimir</button>
    <span>Los QR llevan a <b>${esc(base)}</b>. ${tesoro.length ? '' : 'Abrí la consola una vez para que se carguen los códigos.'}</span></div>
  <div class="u"><h1>Noche de Genios</h1><p>Escaneá y sumá a tu equipo</p>${qrSvg(base + '/jugar')}<p><b>${esc(base)}/jugar</b></p></div>
  <div class="g">${tarjetas}</div></body></html>`);
});

// ---------- Tiempo real ----------
const pendientes = new Map(); // id de acción → callback del celular
let proximoId = 1;
const publicos = {};          // listas que la consola comparte a pedido (invitados, temas)
const ID_TEMA = /^spotify:track:[A-Za-z0-9]{22}$/;

function consolaActiva() {
  const sala = io.sockets.adapter.rooms.get('consola');
  if (!sala) return null;
  for (const id of sala) { const s = io.sockets.sockets.get(id); if (s && s.connected) return s; }
  return null;
}

io.on('connection', socket => {
  socket.on('hola', () => {
    if (ultimoEstado) socket.emit('estado', ultimoEstado);
    else io.to('consola').emit('pedirEstado'); // el servidor se reinició: que la consola vuelva a mandar el estado
  });

  socket.on('login', (pin, cb) => {
    if (typeof cb !== 'function') return;
    if (String(pin) !== PIN) return cb({ ok: false });
    socket.data.admin = true;
    socket.join('consola');
    cb({ ok: true, contenido, respaldo, spotify: spEstado() });
  });

  // Consola → todos
  socket.on('estado', v => {
    if (!socket.data.admin || !v) return;
    ultimoEstado = v;
    socket.broadcast.except('consola').emit('estado', v);
    guardar('estado.json', v);
  });
  socket.on('contenido', c => { if (socket.data.admin && c) { contenido = c; guardar('contenido.json', c); } });
  socket.on('respaldo', g => { if (socket.data.admin && g) { respaldo = g; guardar('respaldo.json', g); } });

  // Celular → consola
  socket.on('accion', (datos, cb) => {
    if (typeof cb !== 'function') return;
    const consola = consolaActiva();
    if (!consola) return cb({ ok: false, msg: 'La consola del conductor no está abierta. Avisale al conductor.' });
    const id = proximoId++;
    const t = setTimeout(() => { if (pendientes.delete(id)) cb({ ok: false, msg: 'La consola no respondió. Probá de nuevo.' }); }, 11000);
    pendientes.set(id, res => { clearTimeout(t); cb(res); });
    consola.emit('accion', { id, datos: datos || {} });
  });
  socket.on('resultado', m => {
    if (!socket.data.admin || !m) return;
    const cb = pendientes.get(m.id);
    if (cb) { pendientes.delete(m.id); cb(m.res || { ok: false }); }
  });

  // Imágenes de las preguntas (lugar, sombras, logos): las sube la consola, que guarda una copia
  const RUTA_IMG = /^\/imagenes\/([a-z0-9]+)\.(jpg|png)$/i;
  socket.on('imagen', (m, cb) => {
    const fin = typeof cb === 'function' ? cb : () => {};
    if (!socket.data.admin || !m) return fin({ ok: false });
    const r = RUTA_IMG.exec(m.ruta || '');
    const d = /^data:image\/(jpeg|png);base64,(.+)$/.exec(m.data || '');
    if (!r || !d) return fin({ ok: false });
    const buf = Buffer.from(d[2], 'base64');
    if (buf.length > 4e6) return fin({ ok: false });
    fs.writeFile(path.join(DIR_IMAGENES, r[1] + '.' + r[2].toLowerCase()), buf, err => fin({ ok: !err }));
  });
  socket.on('faltan', (lista, cb) => {
    if (!socket.data.admin || typeof cb !== 'function' || !Array.isArray(lista)) return;
    cb(lista.filter(ruta => { const r = RUTA_IMG.exec(ruta || ''); return r && !fs.existsSync(path.join(DIR_IMAGENES, r[1] + '.' + r[2].toLowerCase())); }));
  });

  // Listas que los celulares piden cuando las necesitan (para no mandarlas en cada actualización)
  socket.on('publico', m => { if (socket.data.admin && m && /^[a-z]{3,20}$/.test(m.clave || '')) publicos[m.clave] = m.datos; });
  socket.on('pedirPublico', (clave, cb) => { if (typeof cb === 'function') cb(publicos[String(clave)] || null); });

  // ---- Spotify ----
  const soloAdmin = (cb) => typeof cb === 'function' ? (socket.data.admin ? cb : null) : (socket.data.admin ? () => {} : null);
  socket.on('spotifyEstado', (_, cb) => { if (typeof cb === 'function') cb(socket.data.admin ? spEstado() : { conectado: !!sp.refresh }); });
  socket.on('spotifyTicket', (_, cb) => {
    const fin = soloAdmin(cb); if (!fin) return;
    const t = crypto.randomBytes(12).toString('hex'); tickets.set(t, 1); setTimeout(() => tickets.delete(t), 5 * 60000);
    fin({ ok: true, url: '/spotify/conectar?t=' + t });
  });
  socket.on('spotifyToken', async rt => {
    if (!socket.data.admin || typeof rt !== 'string' || sp.refresh || !SPOTIFY_ID) return;
    sp.refresh = rt;
    try { await spAcceso(); await spUsuario(); } catch (e) { if (sp.refresh === rt) sp.refresh = ''; }
    avisarConsola();
  });
  socket.on('spotifyDesconectar', () => { if (!socket.data.admin) return; Object.assign(sp, { refresh: '', access: '', vence: 0, usuario: '', playlist: null }); avisarConsola(); });
  socket.on('spotifyRecordarPlaylist', pl => { if (socket.data.admin && pl && pl.id && !sp.playlist) { sp.playlist = { id: String(pl.id), nombre: String(pl.nombre || ''), url: String(pl.url || '') }; avisarConsola(); } });
  socket.on('spotifyCrearPlaylist', async (nombre, cb) => {
    const fin = soloAdmin(cb); if (!fin) return;
    try {
      const d = await spApi('POST', '/me/playlists', { name: String(nombre || 'Noche de Genios').slice(0, 90), public: true, description: 'Los temas que eligieron los jugadores de la Noche de Genios · Club GEI' });
      sp.playlist = { id: d.id, nombre: d.name, url: (d.external_urls && d.external_urls.spotify) || '' };
      avisarConsola(); fin({ ok: true, playlist: sp.playlist });
    } catch (e) { fin({ ok: false, msg: e.message }); }
  });
  socket.on('spotifyUsarPlaylist', async (link, cb) => {
    const fin = soloAdmin(cb); if (!fin) return;
    const m = /playlist[/:]([A-Za-z0-9]{22})/.exec(String(link || '')) || /^([A-Za-z0-9]{22})$/.exec(String(link || '').trim());
    if (!m) return fin({ ok: false, msg: 'Pegá el link de la playlist (Compartir → Copiar enlace).' });
    try {
      const d = await spApi('GET', '/playlists/' + m[1] + '?fields=id,name,external_urls');
      sp.playlist = { id: d.id, nombre: d.name, url: (d.external_urls && d.external_urls.spotify) || '' };
      avisarConsola(); fin({ ok: true, playlist: sp.playlist });
    } catch (e) { fin({ ok: false, msg: e.status === 404 ? 'No encontré esa playlist.' : e.message }); }
  });
  socket.on('spotifyAgregar', async (m, cb) => {
    const fin = soloAdmin(cb); if (!fin) return;
    if (!m || !ID_TEMA.test(m.uri || '')) return fin({ ok: false, msg: 'Tema inválido.' });
    if (!sp.playlist) return fin({ ok: false, msg: 'No hay playlist elegida.' });
    try { await spApi('POST', '/playlists/' + sp.playlist.id + '/items', { uris: [m.uri] }); fin({ ok: true }); }
    catch (e) { fin({ ok: false, msg: e.status === 403 ? 'Spotify no dejó agregar (¿la playlist es de otra cuenta?).' : e.message }); }
  });
  socket.on('spotifyQuitar', async (m, cb) => {
    const fin = soloAdmin(cb); if (!fin) return;
    if (!m || !ID_TEMA.test(m.uri || '') || !sp.playlist) return fin({ ok: false });
    try { await spApi('DELETE', '/playlists/' + sp.playlist.id + '/items', { items: [{ uri: m.uri }] }); fin({ ok: true }); }
    catch (e) { fin({ ok: false, msg: e.message }); }
  });
  // Búsqueda: la usan los celulares (y la consola para armar la lista)
  let ultimaBusqueda = 0;
  socket.on('spotifyBuscar', async (q, cb) => {
    if (typeof cb !== 'function') return;
    q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (q.length < 2) return cb({ ok: true, temas: [] });
    if (!sp.refresh) return cb({ ok: false, msg: 'La búsqueda en Spotify no está disponible ahora.' });
    const ahora = Date.now();
    if (ahora - ultimaBusqueda < 600) return cb({ ok: false, msg: 'Más despacio 🙂' });
    ultimaBusqueda = ahora;
    try {
      const d = await spApi('GET', '/search?' + new URLSearchParams({ q, type: 'track', limit: '10' }));
      const temas = ((d.tracks && d.tracks.items) || []).filter(Boolean).map(t => {
        const imgs = (t.album && t.album.images) || [];
        const img = imgs.length ? imgs[imgs.length - 1].url : '';
        return { uri: t.uri, titulo: t.name, artista: (t.artists || []).map(a => a.name).join(', '), img, explicit: !!t.explicit };
      });
      cb({ ok: true, temas });
    } catch (e) { cb({ ok: false, msg: e.status === 429 ? 'Spotify está ocupado, probá en unos segundos.' : 'No se pudo buscar en Spotify.' }); }
  });

  // Fotos de los desafíos
  socket.on('foto', (dataUrl, cb) => {
    if (typeof cb !== 'function') return;
    const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return cb({ ok: false, msg: 'La imagen no se pudo leer. Probá con otra.' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 5e6) return cb({ ok: false, msg: 'La foto es demasiado pesada.' });
    const id = 'f' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    fs.writeFile(path.join(DIR_FOTOS, id + '.jpg'), buf, err => cb(err ? { ok: false, msg: 'No se pudo guardar la foto.' } : { ok: true, id }));
  });
});

server.listen(PORT, () => {
  const base = BASE_URL || ('http://' + ipLocal() + ':' + PORT);
  console.log('\n==============================================');
  console.log('  Noche de Genios · Club GEI — ¡servidor andando!');
  console.log('==============================================');
  console.log('  Consola:    ' + base + '/          (PIN: ' + (process.env.PIN ? 'el configurado' : PIN) + ')');
  console.log('  Proyector:  ' + base + '/pantalla');
  console.log('  Jugadores:  ' + base + '/jugar');
  console.log('==============================================\n');
});
