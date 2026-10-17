// 最小的零依赖 SPA 静态服务器，把 dist-web 暴露到 :5000，/api 代理到 :3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'dist-web');
const PORT = 5000;
const API = 'http://localhost:3000';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // 反向代理 /api/* 到 NestJS
  if (req.url.startsWith('/api/')) {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    const proxy = http.request(opts, (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers);
      pres.pipe(res);
    });
    proxy.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`API proxy error: ${e.message}`);
    });
    req.pipe(proxy);
    return;
  }

  // 静态文件
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  let filePath = path.join(ROOT, rel);
  // SPA fallback
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`preview server: http://localhost:${PORT}  (api -> ${API})`);
});