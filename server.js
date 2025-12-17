import http from 'http';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT; // ✅ MUST use dynamic port from cPanel

const app = next({ dev });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();

    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, () => {
      console.log('✅ Next.js app running on port ${port}');
    });

    // Optional: handle errors
    server.on('error', (err) => {
      console.error('Server error:', err);
    });

  } catch (err) {
    console.error('Failed to start Next.js app:', err);
  }
}

startServer();