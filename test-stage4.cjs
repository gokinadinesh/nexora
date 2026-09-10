/**
 * NEXORA STAGE 4 VERIFICATION SUITE
 * Tests Real-Time Matchmaking, Rating-Aware FIFO Matching, Match Sessions,
 * Database Records, Sockets, and Security Authorization
 */

const http = require('http');
const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:4000';

function httpRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('--- STARTING NEXORA STAGE 4 VERIFICATION SUITE ---');
  console.log('====================================================\n');

  try {
    // 1. Health check
    console.log('1. Verifying Health Endpoint: GET /api/health');
    const healthRes = await httpRequest('GET', '/api/health');
    if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes)}`);
    }
    console.log('✔ Health check passed [200 OK]\n');

    // 2. Register 3 Operatives
    console.log('2. Registering Operatives: Player A, Player B, and Third-Party Player C');
    const rand = Math.floor(1000 + Math.random() * 9000);

    const playerAReg = await httpRequest('POST', '/api/auth/register', {
      username: `operative_A_${rand}`,
      email: `op_A_${rand}@grid.io`,
      password: 'CyberPassword!123',
    });
    const tokenA = playerAReg.data.token;
    const userA = playerAReg.data.user;

    const playerBReg = await httpRequest('POST', '/api/auth/register', {
      username: `operative_B_${rand}`,
      email: `op_B_${rand}@grid.io`,
      password: 'CyberPassword!123',
    });
    const tokenB = playerBReg.data.token;
    const userB = playerBReg.data.user;

    const playerCReg = await httpRequest('POST', '/api/auth/register', {
      username: `operative_C_${rand}`,
      email: `op_C_${rand}@grid.io`,
      password: 'CyberPassword!123',
    });
    const tokenC = playerCReg.data.token;

    console.log(`✔ Player A registered: ${userA.username} (${userA.id})`);
    console.log(`✔ Player B registered: ${userB.username} (${userB.id})`);
    console.log(`✔ Player C registered (observer)\n`);

    // 3. Connect Socket A and Test Queue Join
    console.log('3. Testing Queue Join: Player A enters matchmaking');
    let socketA = await connectSocket(tokenA);
    console.log(`   Connected Socket A: ${socketA.id}`);

    const joinARes = await httpRequest('POST', '/api/matchmaking/join', { socketId: socketA.id }, tokenA);
    console.log('Join Response A:', joinARes.data);
    if (joinARes.status !== 200 || joinARes.data.status !== 'QUEUED') {
      throw new Error(`Expected QUEUED status for single player, got: ${JSON.stringify(joinARes)}`);
    }
    console.log('✔ Player A successfully queued [200 OK]\n');

    // 4. Test Queue Duplicate Protection
    console.log('4. Testing Queue Duplicate Prevention: Player A attempts duplicate join');
    const dupJoinRes = await httpRequest('POST', '/api/matchmaking/join', { socketId: socketA.id }, tokenA);
    console.log('Duplicate Join Status:', dupJoinRes.status, dupJoinRes.data);
    if (dupJoinRes.status !== 400 || dupJoinRes.data.code !== 'ALREADY_QUEUED') {
      throw new Error(`Expected ALREADY_QUEUED 400 error, got: ${JSON.stringify(dupJoinRes)}`);
    }
    console.log('✔ Duplicate queue entry prevented [400 Rejected]\n');

    // 5. Test Queue Leave
    console.log('5. Testing Queue Leave: Player A cancels matchmaking');
    const leaveRes = await httpRequest('POST', '/api/matchmaking/leave', {}, tokenA);
    if (leaveRes.status !== 200 || leaveRes.data.status !== 'NOT_QUEUED') {
      throw new Error(`Expected NOT_QUEUED on leave, got: ${JSON.stringify(leaveRes)}`);
    }
    const statusAfterLeave = await httpRequest('GET', '/api/matchmaking/status', null, tokenA);
    if (statusAfterLeave.data.status !== 'NOT_QUEUED') {
      throw new Error(`Expected status to be NOT_QUEUED, got: ${JSON.stringify(statusAfterLeave)}`);
    }
    console.log('✔ Player A successfully removed from queue [200 OK]\n');

    // 6. Test Disconnect Cleanup
    console.log('6. Testing Disconnect Cleanup: Player A joins and abruptly disconnects');
    await httpRequest('POST', '/api/matchmaking/join', { socketId: socketA.id }, tokenA);
    socketA.disconnect();
    await new Promise((r) => setTimeout(r, 300)); // wait for server disconnect event

    const statusAfterDisconnect = await httpRequest('GET', '/api/matchmaking/status', null, tokenA);
    if (statusAfterDisconnect.data.status !== 'NOT_QUEUED') {
      throw new Error(`Expected player to be removed upon disconnect, but status was: ${JSON.stringify(statusAfterDisconnect)}`);
    }
    console.log('✔ Disconnected player automatically cleared from queue\n');

    // 7. Test Real Matchmaking Pairing: Player A and Player B
    console.log('7. Testing Real Matchmaking: Connecting Player A & Player B for match creation');
    socketA = await connectSocket(tokenA);
    const socketB = await connectSocket(tokenB);

    let socketAMatchFoundPromise = new Promise((resolve) => {
      socketA.once('MATCH_FOUND', (payload) => resolve(payload));
    });

    let socketBMatchFoundPromise = new Promise((resolve) => {
      socketB.once('MATCH_FOUND', (payload) => resolve(payload));
    });

    // Player A joins queue
    const p1Join = await httpRequest('POST', '/api/matchmaking/join', { socketId: socketA.id }, tokenA);
    if (p1Join.data.status !== 'QUEUED') {
      throw new Error(`Expected Player A to queue, got ${JSON.stringify(p1Join)}`);
    }
    console.log(`   Player A queued. Waiting for opponent...`);

    // Player B joins queue -> Server should match them immediately!
    const p2Join = await httpRequest('POST', '/api/matchmaking/join', { socketId: socketB.id }, tokenB);
    console.log('   Player B joined. Response:', p2Join.data);

    if (p2Join.data.status !== 'MATCH_FOUND' || !p2Join.data.matchId) {
      throw new Error(`Expected MATCH_FOUND for Player B, got ${JSON.stringify(p2Join)}`);
    }

    const matchId = p2Join.data.matchId;
    console.log(`✔ Match formed by server! Match ID: ${matchId}`);

    // Wait for Socket events
    const [matchFoundA, matchFoundB] = await Promise.all([
      socketAMatchFoundPromise,
      socketBMatchFoundPromise,
    ]);

    if (matchFoundA.matchId !== matchId || matchFoundB.matchId !== matchId) {
      throw new Error('Socket match IDs do not match server matchId');
    }
    console.log('✔ Both Socket A and Socket B received MATCH_FOUND with identical matchId\n');

    // 8. Test Database Match Details & Statuses
    console.log('8. Testing Persistent Match Retrieval: GET /api/matches/:id');
    const matchDetailsRes = await httpRequest('GET', `/api/matches/${matchId}`, null, tokenA);
    if (matchDetailsRes.status !== 200) {
      throw new Error(`Failed to fetch match details: ${JSON.stringify(matchDetailsRes)}`);
    }

    const matchDetails = matchDetailsRes.data;
    console.log('Match Session Details:', {
      id: matchDetails.id,
      status: matchDetails.status,
      playersCount: matchDetails.players.length,
      players: matchDetails.players.map((p) => ({ username: p.username, rating: p.rating })),
    });

    if (matchDetails.status !== 'ACTIVE' || matchDetails.players.length !== 2) {
      throw new Error(`Expected 2 players and ACTIVE status, got: ${JSON.stringify(matchDetails)}`);
    }
    console.log('✔ Database match session verified: Status ACTIVE with both players linked [200 OK]\n');

    // 9. Test Authorization & Privacy
    console.log('9. Testing Security Authorization: Preventing unauthorized match snooping');
    const unauthorizedRes = await httpRequest('GET', `/api/matches/${matchId}`, null, tokenC);
    console.log('Third-Party Player C Access Status:', unauthorizedRes.status, unauthorizedRes.data);
    if (unauthorizedRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unrelated user, got: ${unauthorizedRes.status}`);
    }
    console.log('✔ Private match access denied to non-participant Operative [403 Forbidden]\n');

    const unauthenticatedRes = await httpRequest('GET', `/api/matches/${matchId}`);
    if (unauthenticatedRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized without token, got: ${unauthenticatedRes.status}`);
    }
    console.log('✔ Unauthenticated access rejected [401 Unauthorized]\n');

    // 10. Test Room Socket Communication
    console.log('10. Testing Match Room Socket Communication');
    const playerJoinedPromise = new Promise((resolve) => {
      socketB.once('PLAYER_JOINED', (payload) => resolve(payload));
    });

    socketA.emit('PLAYER_JOINED', { matchId });
    const joinedPayload = await Promise.race([
      playerJoinedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for PLAYER_JOINED')), 3000)),
    ]);

    console.log('Room Notification Received by Opponent:', joinedPayload);
    console.log('✔ Match room event broadcast verified between paired players\n');

    // Clean up sockets
    socketA.disconnect();
    socketB.disconnect();

    console.log('====================================================');
    console.log('✔ ALL STAGE 4 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ STAGE 4 TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

runTests();
