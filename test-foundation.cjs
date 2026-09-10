const http = require('http');
const { io } = require('socket.io-client');

async function runTests() {
  console.log('--- STARTING NEXORA BACKEND & SOCKET TESTS ---');

  // Test 1: GET /api/health
  const healthResponse = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4000/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  console.log('GET /api/health response:', healthResponse);

  if (
    healthResponse.statusCode !== 200 ||
    healthResponse.body.status !== 'ok' ||
    healthResponse.body.service !== 'nexora-server'
  ) {
    throw new Error('Health check failed expectation: ' + JSON.stringify(healthResponse));
  }
  console.log('✔ Health check passed with status 200 and expected payload');

  // Test 2: Socket.IO Connection & Disconnection
  const socket = io('http://127.0.0.1:4000', {
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Socket connection timed out'));
    }, 5000);

    socket.on('connect', () => {
      console.log('✔ Socket client connected successfully! Socket ID:', socket.id);
      clearTimeout(timer);
      setTimeout(() => {
        socket.disconnect();
        console.log('✔ Socket client disconnected successfully');
        resolve();
      }, 500);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log('--- ALL BACKEND TESTS COMPLETED SUCCESSFULLY ---');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
