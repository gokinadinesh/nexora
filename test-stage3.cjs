const http = require('http');
const { io } = require('socket.io-client');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStage3Tests() {
  console.log('====================================================');
  console.log('--- STARTING NEXORA STAGE 3 VERIFICATION SUITE ---');
  console.log('====================================================\n');

  // Test 1: GET /api/health
  console.log('1. Verifying Health Endpoint: GET /api/health');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/health',
    method: 'GET',
  });
  if (healthRes.statusCode !== 200 || healthRes.body.status !== 'ok') {
    throw new Error('Health check failed: ' + JSON.stringify(healthRes.body));
  }
  console.log('✔ Health check passed [200 OK]\n');

  // Test 2: User Registration & Initial Profile
  console.log('2. Testing Registration & Extended Profile Defaults');
  const suffix = Date.now().toString().slice(-4);
  const testUser = {
    username: `pilot_${suffix}`,
    email: `pilot_${suffix}@grid.io`,
    password: 'CyberPassword2026!',
  };

  const regRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    testUser
  );

  if (regRes.statusCode !== 201 || !regRes.body.token) {
    throw new Error('Registration failed: ' + JSON.stringify(regRes.body));
  }
  const token = regRes.body.token;
  console.log('✔ User registered successfully [201 Created]');

  // Test 3: GET /api/profile
  console.log('3. Testing GET /api/profile (Competitive fields)');
  const unauthProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/profile',
    method: 'GET',
  });
  if (unauthProfileRes.statusCode !== 401) {
    throw new Error('Unauthenticated /api/profile was not rejected with 401');
  }

  const profileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/profile',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Profile payload:', profileRes.body);
  if (
    profileRes.statusCode !== 200 ||
    profileRes.body.rating !== 1000 ||
    profileRes.body.wins !== 0 ||
    profileRes.body.losses !== 0 ||
    profileRes.body.matchesPlayed !== 0
  ) {
    throw new Error('Profile defaults mismatch: ' + JSON.stringify(profileRes.body));
  }
  if ('password_hash' in profileRes.body || 'password' in profileRes.body) {
    throw new Error('CRITICAL SECURITY: password_hash exposed in profile!');
  }
  console.log('✔ Profile verified: default rating=1000, wins=0, losses=0, matchesPlayed=0 [200 OK]\n');

  // Test 4: PATCH /api/profile (Safe Update)
  console.log('4. Testing PATCH /api/profile (Safe Profile Update)');
  const patchRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/profile',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      displayName: 'GridMaster_Vortex',
      avatar: 'neon_spectre',
    }
  );

  console.log('PATCH Response:', patchRes.body);
  if (
    patchRes.statusCode !== 200 ||
    patchRes.body.displayName !== 'GridMaster_Vortex' ||
    patchRes.body.avatar !== 'neon_spectre'
  ) {
    throw new Error('PATCH /api/profile failed: ' + JSON.stringify(patchRes.body));
  }
  console.log('✔ Safe fields (displayName, avatar) updated successfully [200 OK]\n');

  // Test 5: PATCH /api/profile (Exploit Rejection)
  console.log('5. Testing Server Authority: Reject client stat tampering');
  const exploitRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/profile',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      rating: 9999,
      wins: 100,
    }
  );

  console.log('Exploit Status:', exploitRes.statusCode, exploitRes.body);
  if (exploitRes.statusCode !== 400) {
    throw new Error('Client stat tampering was not rejected with 400 Bad Request');
  }

  // Re-verify rating remains 1000
  const verifyStatsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/profile',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (verifyStatsRes.body.rating !== 1000) {
    throw new Error('Rating was illegally modified! Value: ' + verifyStatsRes.body.rating);
  }
  console.log('✔ Competitive statistics are strictly protected under server authority [400 Rejected]\n');

  // Test 6: GET /api/lobby
  console.log('6. Testing Lobby Endpoint: GET /api/lobby');
  const unauthLobbyRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/lobby',
    method: 'GET',
  });
  if (unauthLobbyRes.statusCode !== 401) {
    throw new Error('Unauthenticated /api/lobby was not rejected with 401');
  }

  const lobbyRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/lobby',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Lobby Response:', lobbyRes.body);
  if (lobbyRes.statusCode !== 200 || typeof lobbyRes.body.playersOnline !== 'number') {
    throw new Error('Invalid lobby response: ' + JSON.stringify(lobbyRes.body));
  }
  console.log('✔ GET /api/lobby returns valid structured statistics [200 OK]\n');

  // Test 7: Multi-Socket Presence Tracking
  console.log('7. Testing Multi-Socket Presence Tracking');
  console.log('   - Step A: Connect Socket A (Tab 1)');

  const socketA = io('http://127.0.0.1:4000', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Socket A connection timeout')), 5000);
    socketA.on('connect', () => {
      clearTimeout(t);
      console.log('   ✔ Socket A connected. ID:', socketA.id);
      resolve();
    });
    socketA.on('connect_error', reject);
  });

  await sleep(200);

  // Check lobby shows user online
  const lobbyWithARes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/lobby',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('   Lobby players after Socket A:', lobbyWithARes.body.players.map((p) => p.username));
  const hasUserA = lobbyWithARes.body.players.some((p) => p.username === testUser.username);
  if (!hasUserA) {
    throw new Error('User not found in lobby after connecting Socket A');
  }
  console.log('   ✔ User is reported ONLINE in lobby roster');

  console.log('   - Step B: Connect Socket B (Tab 2 for same user)');
  const socketB = io('http://127.0.0.1:4000', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Socket B connection timeout')), 5000);
    socketB.on('connect', () => {
      clearTimeout(t);
      console.log('   ✔ Socket B connected. ID:', socketB.id);
      resolve();
    });
    socketB.on('connect_error', reject);
  });

  await sleep(200);

  console.log('   - Step C: Disconnect Socket A (User should REMAIN ONLINE via Socket B)');
  socketA.disconnect();
  await sleep(400);

  const lobbyAfterADisconnect = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/lobby',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const stillOnline = lobbyAfterADisconnect.body.players.some((p) => p.username === testUser.username);
  console.log('   User still in lobby after Socket A disconnect:', stillOnline);
  if (!stillOnline) {
    throw new Error('CRITICAL BUG: User was prematurely marked OFFLINE while Socket B was still active!');
  }
  console.log('   ✔ Multi-socket tracking verified: User remains ONLINE when auxiliary socket disconnects');

  console.log('   - Step D: Disconnect Socket B (Final socket - User should now become OFFLINE)');
  socketB.disconnect();
  await sleep(400);

  const lobbyAfterBDisconnect = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/lobby',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const isNowOffline = !lobbyAfterBDisconnect.body.players.some((p) => p.username === testUser.username);
  console.log('   User removed from lobby after final socket disconnect:', isNowOffline);
  if (!isNowOffline) {
    throw new Error('User was not marked OFFLINE after final socket disconnected');
  }
  console.log('   ✔ User cleanly transitioned to OFFLINE only after final socket disconnected\n');

  console.log('====================================================');
  console.log('✔ ALL STAGE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runStage3Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ STAGE 3 TEST SUITE FAILED:', err);
    process.exit(1);
  });
