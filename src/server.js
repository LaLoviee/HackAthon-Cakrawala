const http = require('http');
const env = require('./config/env');
const { checkConnection } = require('./config/supabase');
const app = require('./app');
const { initSockets } = require('./sockets');
const board = require('./services/board.service');
const { startAutoEndJob } = require('./jobs/autoEnd');

async function main() {
  await checkConnection();
  const server = http.createServer(app);
  initSockets(server);
  board.startFlusher();
  startAutoEndJob();

  server.listen(env.port, () => console.log(`[server] CakraBoard backend jalan di http://localhost:${env.port}`));

  const shutdown = async () => {
    setTimeout(() => process.exit(1), 5000).unref();
    await board.flushEvents(); // jangan kehilangan rekaman yang masih di buffer
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
