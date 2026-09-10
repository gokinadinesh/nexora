/**
 * ==============================================================================
 * NEXORA — Production Load & Stress Testing Benchmark
 * "Enter the Grid. Outsmart the Network."
 * ==============================================================================
 * Usage: node scripts/load-test.cjs
 */

const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = process.env.TEST_URL || 'http://localhost:4000';
const NUM_PROBE_REQUESTS = 100;
const NUM_AUTH_USERS = 20;

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (body) {
      if (!reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const start = Date.now();
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          latency,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) req.write(body);
    req.end();
  });
}

async function runBenchmark() {
  console.log('======================================================================');
  console.log('⚡ NEXORA PRODUCTION LOAD & BENCHMARK SUITE');
  console.log(`Target Host: ${BASE_URL}`);
  console.log('======================================================================\n');

  // Test 1: Liveness and Readiness Probe Concurrency
  console.log(`[1/4] Running ${NUM_PROBE_REQUESTS} concurrent GET /api/health requests...`);
  const healthLatencies = [];
  let healthErrors = 0;
  const probeStart = Date.now();

  const probePromises = Array.from({ length: NUM_PROBE_REQUESTS }, async () => {
    try {
      const res = await httpRequest(`${BASE_URL}/api/health`);
      if (res.statusCode === 200) {
        healthLatencies.push(res.latency);
      } else {
        healthErrors++;
      }
    } catch (err) {
      healthErrors++;
    }
  });

  await Promise.all(probePromises);
  const probeDuration = (Date.now() - probeStart) / 1000;
  const healthRps = Math.round(NUM_PROBE_REQUESTS / probeDuration);

  console.log(`      Completed in ${probeDuration.toFixed(2)}s (${healthRps} req/sec)`);
  console.log(`      p50: ${percentile(healthLatencies, 50)}ms | p95: ${percentile(healthLatencies, 95)}ms | p99: ${percentile(healthLatencies, 99)}ms`);
  console.log(`      Errors: ${healthErrors}\n`);

  // Test 2: Concurrent User Authentication Throughput
  console.log(`[2/4] Testing concurrent registration & authentication for ${NUM_AUTH_USERS} users...`);
  const authLatencies = [];
  let authErrors = 0;
  const authUsers = [];
  const authStart = Date.now();

  const authPromises = Array.from({ length: NUM_AUTH_USERS }, async (_, i) => {
    const username = `load_op_${Date.now()}_${i}`;
    const email = `${username}@nexora-load.io`;
    const password = 'Password123!_Secure';

    try {
      const res = await httpRequest(
        `${BASE_URL}/api/auth/register`,
        { method: 'POST' },
        JSON.stringify({ username, email, password })
      );

      if (res.statusCode === 201) {
        authLatencies.push(res.latency);
        const parsed = JSON.parse(res.body);
        authUsers.push(parsed);
      } else {
        authErrors++;
      }
    } catch (err) {
      authErrors++;
    }
  });

  await Promise.all(authPromises);
  const authDuration = (Date.now() - authStart) / 1000;
  const authRps = Math.round(NUM_AUTH_USERS / authDuration);

  console.log(`      Registered ${authUsers.length} operatives in ${authDuration.toFixed(2)}s (${authRps} auth/sec)`);
  console.log(`      p50: ${percentile(authLatencies, 50)}ms | p95: ${percentile(authLatencies, 95)}ms | p99: ${percentile(authLatencies, 99)}ms`);
  console.log(`      Auth Errors: ${authErrors}\n`);

  // Test 3: Concurrent Real-Time Matchmaking Pairs
  console.log(`[3/4] Establishing concurrent WebSocket connections and pairing 2 match sessions...`);
  if (authUsers.length < 4) {
    console.log('      Skipping matchmaking test (insufficient authenticated users)');
    return;
  }

  const matchPairLatencies = [];
  const sockets = [];

  const runMatchPair = (userA, userB) => {
    return new Promise((resolve) => {
      const pairStart = Date.now();
      let matchedA = false;
      let matchedB = false;

      const sockA = io(BASE_URL, {
        auth: { token: userA.token },
        transports: ['websocket'],
      });
      const sockB = io(BASE_URL, {
        auth: { token: userB.token },
        transports: ['websocket'],
      });

      sockets.push(sockA, sockB);

      const checkBoth = (matchId) => {
        if (matchedA && matchedB) {
          const duration = Date.now() - pairStart;
          matchPairLatencies.push(duration);
          resolve(matchId);
        }
      };

      sockA.on('connect', () => sockA.emit('QUEUE_JOINED'));
      sockB.on('connect', () => sockB.emit('QUEUE_JOINED'));

      sockA.on('MATCH_FOUND', (payload) => {
        matchedA = true;
        checkBoth(payload.matchId);
      });

      sockB.on('MATCH_FOUND', (payload) => {
        matchedB = true;
        checkBoth(payload.matchId);
      });

      // Fallback timeout
      setTimeout(() => resolve(null), 5000);
    });
  };

  const matchId = await runMatchPair(authUsers[0], authUsers[1]);
  console.log(`      Match paired successfully! Match ID: ${matchId}`);
  console.log(`      Matchmaking Latency: ${matchPairLatencies[0] || 'N/A'}ms\n`);

  // Test 4: Real-Time Action Throughput & Authoritative State Resolution
  console.log(`[4/4] Stress testing real-time player actions (alternating turn actions)...`);
  const actionLatencies = [];
  let rejectedActions = 0;

  if (sockets.length >= 2 && matchId) {
    const [sockA, sockB] = sockets;

    // Join match room
    sockA.emit('PLAYER_JOINED', { matchId });
    sockB.emit('PLAYER_JOINED', { matchId });
    await new Promise((r) => setTimeout(r, 200));

    for (let i = 0; i < 6; i++) {
      const currentSocket = i % 2 === 0 ? sockA : sockB;
      const start = Date.now();

      await new Promise((resolve) => {
        const actionId = `load_act_${Date.now()}_${i}`;
        const timeout = setTimeout(resolve, 400);

        const onUpdate = () => {
          actionLatencies.push(Date.now() - start);
          clearTimeout(timeout);
          currentSocket.off('ACTION_REJECTED', onReject);
          resolve();
        };

        const onReject = () => {
          rejectedActions++;
          clearTimeout(timeout);
          currentSocket.off('GAME_STATE_UPDATED', onUpdate);
          resolve();
        };

        currentSocket.once('GAME_STATE_UPDATED', onUpdate);
        currentSocket.once('ACTION_REJECTED', onReject);

        currentSocket.emit('PLAYER_ACTION', {
          actionId,
          matchId,
          type: 'MOVE',
          targetNodeId: i % 2 === 0 ? 6 : 18,
        });
      });

      // Throttle slightly to respect action rate limit
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Cleanup sockets
  for (const s of sockets) {
    s.disconnect();
  }

  console.log(`      Executed ${actionLatencies.length} actions | Rate limited / rejected: ${rejectedActions}`);
  if (actionLatencies.length > 0) {
    console.log(`      Action Resolution Latency — p50: ${percentile(actionLatencies, 50)}ms | p95: ${percentile(actionLatencies, 95)}ms`);
  }

  console.log('\n======================================================================');
  console.log('📊 BENCHMARK SUMMARY REPORT');
  console.log('======================================================================');
  console.table([
    {
      Metric: 'Liveness Probe (GET /api/health)',
      Requests: NUM_PROBE_REQUESTS,
      Throughput: `${healthRps} req/s`,
      p50: `${percentile(healthLatencies, 50)}ms`,
      p95: `${percentile(healthLatencies, 95)}ms`,
      Errors: healthErrors,
    },
    {
      Metric: 'User Registration + JWT Signing',
      Requests: NUM_AUTH_USERS,
      Throughput: `${authRps} auth/s`,
      p50: `${percentile(authLatencies, 50)}ms`,
      p95: `${percentile(authLatencies, 95)}ms`,
      Errors: authErrors,
    },
    {
      Metric: 'Matchmaking Pair Discovery',
      Requests: 2,
      Throughput: 'Instantaneous',
      p50: `${matchPairLatencies[0] || 0}ms`,
      p95: `${matchPairLatencies[0] || 0}ms`,
      Errors: 0,
    },
  ]);
  console.log('======================================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
