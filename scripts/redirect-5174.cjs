const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(302, { Location: `http://localhost:5173${req.url}` });
  res.end();
});

server.listen(5174, '0.0.0.0', () => {
  console.log('Port 5174 redirector to http://localhost:5173 is active');
});
