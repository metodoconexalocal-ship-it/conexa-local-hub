const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'forms/ficha-gmb.html' : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.includes('forms') && !filePath.includes('js') && !filePath.includes('css')) {
    filePath = path.join(__dirname, 'forms/ficha-gmb.html');
  }
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 - Arquivo não encontrado</h1><p>${filePath}</p>`);
      return;
    }
    
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✓ Servidor de teste rodando em: http://localhost:${PORT}`);
  console.log('✓ Formulário disponível em: http://localhost:8888/forms/ficha-gmb.html\n');
  console.log('Pressione CTRL+C para parar.\n');
});
