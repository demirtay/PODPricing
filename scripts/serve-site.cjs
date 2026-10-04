// Yerel önizleme: site/ klasörünü sunar, katalogları zamanlanmış olarak yeniler
// ve catalog.json değiştiğinde siteyi yeniden üretir.
// Kullanım: node scripts/serve-site.cjs [--skip-initial] [--no-refresh] [--port 4173]
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..'), site = path.join(root, 'site'), catalogFile = path.join(root, 'data/catalog.json');
const argPort = process.argv.indexOf('--port');
const port = argPort > -1 ? Number(process.argv[argPort + 1]) : 4173;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

let building = false, pending = false;
function build() {
  if (building) { pending = true; return; }
  building = true;
  const t = Date.now();
  const child = spawn(process.execPath, [path.join(__dirname, 'build-site.cjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write('[site] ' + d));
  child.stderr.on('data', d => process.stderr.write('[site] ' + d));
  child.on('exit', code => {
    building = false;
    console.log(`[site] ${code === 0 ? 'yeniden üretildi' : 'üretim HATASI'} (${Math.round((Date.now() - t) / 1000)} sn)`);
    if (pending) { pending = false; build(); }
  });
}

const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400).end(); return; }
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.resolve(site, '.' + rel);
  if (!file.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.writeHead(301, { Location: u.pathname + '/' }).end(); return; }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': mime['.html'] }); res.end(fs.existsSync(path.join(site, '404.html')) ? fs.readFileSync(path.join(site, '404.html')) : 'Bulunamadı'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`POD Atlas: http://127.0.0.1:${port}`);
  if (!fs.existsSync(path.join(site, 'index.html'))) build();
  if (process.argv.includes('--no-refresh')) return;
  const manager = require('./refresh-catalogs.cjs');
  manager.start(process.argv.includes('--skip-initial') ? Object.keys(manager.definitions) : []);
  // katalog değişince, yenilemeler durulduktan 3 dk sonra siteyi yeniden üret
  let last = fs.statSync(catalogFile).mtimeMs, timer = null;
  setInterval(() => {
    const m = fs.statSync(catalogFile).mtimeMs;
    if (m !== last) { last = m; clearTimeout(timer); timer = setTimeout(build, 3 * 60000); }
  }, 30000);
});
