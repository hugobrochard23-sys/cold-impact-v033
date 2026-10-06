/* Petit serveur statique local (aucune dépendance) : node tools/serve.js [port]
 * Utile pour les navigateurs qui bloquent file:// ; le jeu fonctionne aussi en ouvrant index.html directement. */
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = parseInt(process.argv[2] || process.env.PORT || '8123', 10);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8' };
http.createServer((req, res) => {
  // outil de développement : POST /__save/<nom>.png (corps = data URL) enregistre une capture dans analysis/graphics/ — local uniquement
  if (req.method === 'POST' && req.url.startsWith('/__save/') && /^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1)$/.test(req.socket.remoteAddress || '')) {
    const name = decodeURIComponent(req.url.slice(8)).replace(/[^a-zA-Z0-9_.-]/g, '');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const dir = path.join(root, 'analysis', 'graphics'); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), Buffer.from(Buffer.concat(chunks).toString().split(',').pop(), 'base64'));
        res.writeHead(200); res.end('ok');
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log('COLD IMPACT : http://localhost:' + port));
