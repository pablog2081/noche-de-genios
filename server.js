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
const DIR_DATOS = path.join(__dirname, 'datos');
const DIR_FOTOS = path.join(DIR_DATOS, 'fotos');
fs.mkdirSync(DIR_FOTOS, { recursive: true });

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
app.get('/vendor/qrcode.js', (req, res) => res.sendFile(require.resolve('qrcode-generator')));
app.get('/api/info', (req, res) => res.json({ base: baseUrl(req) }));
app.use('/fotos', express.static(DIR_FOTOS, { maxAge: '1d' }));
app.use(express.static(path.join(__dirname, 'public')));

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

function consolaActiva() {
  const sala = io.sockets.adapter.rooms.get('consola');
  if (!sala) return null;
  for (const id of sala) { const s = io.sockets.sockets.get(id); if (s && s.connected) return s; }
  return null;
}

io.on('connection', socket => {
  socket.on('hola', () => { if (ultimoEstado) socket.emit('estado', ultimoEstado); });

  socket.on('login', (pin, cb) => {
    if (typeof cb !== 'function') return;
    if (String(pin) !== PIN) return cb({ ok: false });
    socket.data.admin = true;
    socket.join('consola');
    cb({ ok: true, contenido, respaldo });
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
