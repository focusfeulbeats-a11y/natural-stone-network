import { createServer } from 'node:http';
import { handleRequest } from './src/app.js';
import { config } from './src/config.js';
import './src/db.js'; // ensures schema is created on boot

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Fatal request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

server.listen(config.port, () => {
  console.log(`Natural Stone Network API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
});
