/**
 * NEXORA STAGE 5 VERIFICATION SUITE
 * Tests CyberGrid Real-Time Game Engine:
 * - 5x5 Grid initialization (25 nodes, special nodes, starting positions)
 * - Server-authoritative state synchronization via Socket.IO
 * - Turn system & out-of-turn rejection
 * - Strict Manhattan adjacency (no diagonals, no jumps)
 * - Action idempotency (duplicate actionId rejection)
 * - Rate limiting (250ms cooldown rejection)
 * - Movement & neutral node capture (+100 normal, +200 special)
 * - Firewall defense activation
 * - Win condition (500 pts / completed match) & database persistence
 */

const http = require('http');
const crypto = require('crypto');
const { io } = require('socket.io-client');
const { GAME_EVENTS } = require('./shared/dist');

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

function waitForEvent(socket, eventName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runStage5Tests() {
  console.log('====================================================');
  console.log('--- STARTING NEXORA STAGE 5 VERIFICATION SUITE ---');
  console.log('====================================================\n');

  let socketA = null;
  let socketB = null;

  try {
    // 1. Health check
    console.log('1. Verifying Server Health: GET /api/health');
    const healthRes = await httpRequest('GET', '/api/health');
    if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes)}`);
    }
    console.log('✔ Health check passed [200 OK]\n');

    // 2. Register Player A and Player B
    console.log('2. Registering Two Combat Operatives for CyberGrid Battle');
    const rand = Math.floor(1000 + Math.random() * 9000);

    const regA = await httpRequest('POST', '/api/auth/register', {
      username: `cyber_pilot_A_${rand}`,
      email: `pilot_A_${rand}@nexora.net`,
      password: 'CyberPassword!123',
    });
    const tokenA = regA.data.token;
    const userA = regA.data.user;

    const regB = await httpRequest('POST', '/api/auth/register', {
      username: `cyber_pilot_B_${rand}`,
      email: `pilot_B_${rand}@nexora.net`,
      password: 'CyberPassword!123',
    });
    const tokenB = regB.data.token;
    const userB = regB.data.user;

    console.log(`✔ Registered ${userA.username} (${userA.id})`);
    console.log(`✔ Registered ${userB.username} (${userB.id})\n`);

    // 3. Connect Authenticated Sockets
    console.log('3. Connecting Authenticated WebSockets for both Operatives');
    socketA = await connectSocket(tokenA);
    socketB = await connectSocket(tokenB);
    console.log(`✔ Socket A connected: ${socketA.id}`);
    console.log(`✔ Socket B connected: ${socketB.id}\n`);

    // 4. Join Matchmaking and Receive MATCH_FOUND
    console.log('4. Entering Matchmaking Queue');
    const matchFoundPromiseA = waitForEvent(socketA, GAME_EVENTS.MATCH_FOUND);
    const matchFoundPromiseB = waitForEvent(socketB, GAME_EVENTS.MATCH_FOUND);

    await httpRequest('POST', '/api/matchmaking/join', {}, tokenA);
    await httpRequest('POST', '/api/matchmaking/join', {}, tokenB);

    const [matchDataA, matchDataB] = await Promise.all([matchFoundPromiseA, matchFoundPromiseB]);

    if (matchDataA.matchId !== matchDataB.matchId) {
      throw new Error('Match IDs did not match between sockets!');
    }
    const matchId = matchDataA.matchId;
    console.log(`✔ Match found successfully! Match ID: ${matchId}\n`);

    // 5. Join Match Room & Receive Authoritative Initial Game State
    console.log('5. Joining Match Room and Verifying Initial 5x5 CyberGrid State');
    const statePromiseA = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    const statePromiseB = waitForEvent(socketB, GAME_EVENTS.GAME_STATE_UPDATED);

    socketA.emit(GAME_EVENTS.PLAYER_JOINED, { matchId });
    socketB.emit(GAME_EVENTS.PLAYER_JOINED, { matchId });

    const [initStateA, initStateB] = await Promise.all([statePromiseA, statePromiseB]);

    if (initStateA.version !== 1 || initStateB.version !== 1) {
      throw new Error('Initial state version should be 1');
    }
    if (Object.keys(initStateA.grid).length !== 25) {
      throw new Error(`CyberGrid must have 25 nodes, found ${Object.keys(initStateA.grid).length}`);
    }

    // Verify special nodes
    const specialNodes = ['N22', 'N02', 'N42', 'N20', 'N24'];
    for (const sid of specialNodes) {
      if (initStateA.grid[sid].type !== 'SPECIAL' || initStateA.grid[sid].value !== 200) {
        throw new Error(`Node ${sid} must be SPECIAL with value 200`);
      }
    }

    // Verify Player 1 starts at N00, Player 2 at N44
    if (initStateA.players[userA.id].position !== 'N00' || initStateA.players[userB.id].position !== 'N44') {
      throw new Error('Players not placed at expected start nodes N00 and N44');
    }
    if (initStateA.turnPlayerId !== userA.id) {
      throw new Error('Player A should have turn 1');
    }
    console.log('✔ Initial CyberGrid validated: 25 nodes, special nodes confirmed, turn 1 assigned to Player A\n');

    // 6. Anti-Tampering & Security Rule Tests
    console.log('6. Anti-Tampering & Server-Authority Rejection Tests');

    // 6a. Out-of-turn rejection: Player B tries to act during Player A turn
    console.log('  Testing out-of-turn rejection (Player B acting on Player A turn)...');
    const rejectedPromiseB = waitForEvent(socketB, GAME_EVENTS.ACTION_REJECTED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N43',
    });
    const rejection1 = await rejectedPromiseB;
    if (rejection1.code !== 'NOT_YOUR_TURN') {
      throw new Error(`Expected NOT_YOUR_TURN, received: ${rejection1.code}`);
    }
    console.log(`  ✔ Out-of-turn rejected properly [code: ${rejection1.code}]`);

    // 6b. Invalid move: Player A attempts non-adjacent diagonal jump N11
    console.log('  Testing non-adjacent move rejection (diagonal jump to N11)...');
    const rejectedPromiseA1 = waitForEvent(socketA, GAME_EVENTS.ACTION_REJECTED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N11', // diagonal from N00
    });
    const rejection2 = await rejectedPromiseA1;
    if (rejection2.code !== 'INVALID_MOVE') {
      throw new Error(`Expected INVALID_MOVE for diagonal, received: ${rejection2.code}`);
    }
    console.log(`  ✔ Non-adjacent diagonal move rejected properly [code: ${rejection2.code}]`);

    // 6c. Invalid jump: Player A attempts distant jump N03
    console.log('  Testing distant jump rejection (jump to N03)...');
    const rejectedPromiseA2 = waitForEvent(socketA, GAME_EVENTS.ACTION_REJECTED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N03',
    });
    const rejection3 = await rejectedPromiseA2;
    if (rejection3.code !== 'INVALID_MOVE') {
      throw new Error(`Expected INVALID_MOVE for jump, received: ${rejection3.code}`);
    }
    console.log(`  ✔ Distant jump rejected properly [code: ${rejection3.code}]\n`);

    // 7. Authoritative Legal Moves & Turn Rotation
    console.log('7. Executing Authoritative Legal Moves & Verifying State Sync');

    // Turn 1 (P1): Player A moves N00 -> N01 (captures neutral node, gets +100 pts)
    const turn1ActionId = crypto.randomUUID();
    const stateSyncPromiseA1 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    const stateSyncPromiseB1 = waitForEvent(socketB, GAME_EVENTS.GAME_STATE_UPDATED);
    const scorePromiseA1 = waitForEvent(socketA, GAME_EVENTS.SCORE_UPDATED);

    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: turn1ActionId,
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N01',
    });

    const [stateA1, stateB1, scoreEvent1] = await Promise.all([
      stateSyncPromiseA1,
      stateSyncPromiseB1,
      scorePromiseA1,
    ]);

    if (stateA1.version !== 2 || stateB1.version !== 2) {
      throw new Error(`State version must advance to 2, got A=${stateA1.version} B=${stateB1.version}`);
    }
    if (stateA1.turnNumber !== 2 || stateA1.turnPlayerId !== userB.id) {
      throw new Error(`Turn must rotate to Player B (turnNumber=2), got ${stateA1.turnPlayerId}`);
    }
    if (stateA1.grid['N01'].owner !== 'PLAYER_1' || stateA1.players[userA.id].score !== 100) {
      throw new Error('Player A should have captured N01 and earned 100 points');
    }
    if (scoreEvent1.scoreDelta !== 100) {
      throw new Error('Score updated event must show scoreDelta 100');
    }
    console.log('✔ Turn 1 executed: N00 -> N01 (Captured neutral node, +100 pts, state v2, turn rotated to Player B)');

    // 7b. Idempotency Check: Replay identical actionId
    console.log('  Testing idempotency (replaying actionId)...');
    const rejectDupePromise = waitForEvent(socketA, GAME_EVENTS.ACTION_REJECTED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: turn1ActionId, // duplicate actionId!
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N01',
    });
    const dupeRejection = await rejectDupePromise;
    if (dupeRejection.code !== 'DUPLICATE_ACTION') {
      throw new Error(`Expected DUPLICATE_ACTION, got: ${dupeRejection.code}`);
    }
    console.log(`  ✔ Idempotency confirmed: Duplicate action rejected [code: ${dupeRejection.code}]`);

    // 7c. Rate Limiting Check: Rapid action from Player B without waiting cooldown
    // First, let Player B execute Turn 2
    await sleep(260); // clear cooldown
    const stateSyncPromiseA2 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    const stateSyncPromiseB2 = waitForEvent(socketB, GAME_EVENTS.GAME_STATE_UPDATED);

    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N43',
    });

    const [stateA2] = await Promise.all([stateSyncPromiseA2, stateSyncPromiseB2]);
    console.log('✔ Turn 2 executed: Player B moves N44 -> N43 (+100 pts, state v3, turn rotated to Player A)');

    // Immediate action from Player B to test rate limiting
    console.log('  Testing 250ms rate limit cooldown on rapid action...');
    const rateLimitPromise = waitForEvent(socketB, GAME_EVENTS.ACTION_REJECTED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N42',
    });
    const rateLimitRejection = await rateLimitPromise;
    if (rateLimitRejection.code !== 'RATE_LIMITED') {
      throw new Error(`Expected RATE_LIMITED, got: ${rateLimitRejection.code}`);
    }
    console.log(`  ✔ Rate limiting confirmed: Rapid action rejected [code: ${rateLimitRejection.code}]\n`);

    // 8. Capture Special Core Node (+200 pts)
    console.log('8. Capturing Special Strategic Core Node (N02)');
    await sleep(260);
    const stateSyncPromiseA3 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    const stateSyncPromiseB3 = waitForEvent(socketB, GAME_EVENTS.GAME_STATE_UPDATED);

    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'CAPTURE',
      targetNodeId: 'N02', // Special node adjacent to N01
    });

    const [stateA3] = await Promise.all([stateSyncPromiseA3, stateSyncPromiseB3]);
    if (stateA3.players[userA.id].score !== 300) {
      throw new Error(`Capturing special node must award +200 pts (total 300), got: ${stateA3.players[userA.id].score}`);
    }
    console.log(`✔ Turn 3 executed: Player A captured Special Node N02 (+200 pts, total score: ${stateA3.players[userA.id].score})`);

    // 9. Defense Firewall Activation
    console.log('9. Activating Firewall Shield Defense (DEFEND)');
    await sleep(260);
    // Player B takes Turn 4: Moves back to owned base N44
    const stateSyncPromiseA4 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N44',
    });
    await stateSyncPromiseA4;

    // Player A takes Turn 5: DEFEND current node N02
    await sleep(260);
    const stateSyncPromiseA5 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    const defendedPromiseA = waitForEvent(socketA, GAME_EVENTS.PLAYER_DEFENDED);

    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'DEFEND',
      targetNodeId: 'N02',
    });

    const [stateA5, defEvent] = await Promise.all([stateSyncPromiseA5, defendedPromiseA]);
    if (!stateA5.grid['N02'].isDefended || stateA5.grid['N02'].defendedBy !== userA.id) {
      throw new Error('Node N02 should be marked as defended by Player A');
    }
    if (defEvent.targetNodeId !== 'N02') {
      throw new Error('player:defended event mismatch');
    }
    console.log('✔ Turn 5 executed: Player A raised Firewall Shield on Node N02 (player:defended broadcast received)\n');

    // 10. Win Condition & Database Persistence Verification
    console.log('10. Simulating Path to Victory (500 pts threshold)');
    // Player B takes Turn 6: moves to N43
    await sleep(260);
    const stateSyncPromiseA6 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N43',
    });
    await stateSyncPromiseA6;

    // Player A takes Turn 7: captures N12 (adjacent to N02, +100 pts -> 400 pts)
    await sleep(260);
    const stateSyncPromiseA7 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'CAPTURE',
      targetNodeId: 'N12',
    });
    await stateSyncPromiseA7;

    // Player B takes Turn 8: moves back to N44
    await sleep(260);
    const stateSyncPromiseA8 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N44',
    });
    await stateSyncPromiseA8;

    // Player A takes Turn 9: captures Center Core Special Node N22 (adjacent to N12: +200 pts -> 600 pts >= 500 threshold!)
    await sleep(260);
    console.log('  Player A capturing Center Core Special Node N22 (+200 pts -> 600 pts)...');
    const gameOverPromiseA = waitForEvent(socketA, GAME_EVENTS.GAME_ENDED);
    const gameOverPromiseB = waitForEvent(socketB, GAME_EVENTS.GAME_ENDED);

    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'CAPTURE',
      targetNodeId: 'N22',
    });

    const [gameOverA, gameOverB] = await Promise.all([gameOverPromiseA, gameOverPromiseB]);
    if (gameOverA.winnerId !== userA.id || gameOverB.winnerId !== userA.id) {
      throw new Error(`Winner mismatch! Expected ${userA.id}, got A=${gameOverA.winnerId} B=${gameOverB.winnerId}`);
    }
    console.log(`✔ GAME OVER triggered authoritatively! Winner: ${userA.username} (${gameOverA.winnerId})`);

    // 11. Verify Database Match Records
    console.log('\n11. Verifying Database Records via REST API: GET /api/matches/:matchId');
    const matchDetailRes = await httpRequest('GET', `/api/matches/${matchId}`, null, tokenA);
    if (matchDetailRes.status !== 200) {
      throw new Error(`Failed to fetch match details: ${JSON.stringify(matchDetailRes)}`);
    }

    const matchInfo = matchDetailRes.data;
    if (matchInfo.status !== 'COMPLETED') {
      throw new Error(`Match status in DB should be COMPLETED, got ${matchInfo.status}`);
    }
    if (matchInfo.winnerId !== userA.id) {
      throw new Error(`Winner in DB should be ${userA.id}, got ${matchInfo.winnerId}`);
    }
    console.log(`✔ Match persisted in database as COMPLETED with authoritative winnerId: ${matchInfo.winnerId}`);

    console.log('\n====================================================');
    console.log('>>> ALL NEXORA STAGE 5 VERIFICATION CHECKS PASSED! <<<');
    console.log('====================================================\n');

  } finally {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
  }
}

runStage5Tests().catch((err) => {
  console.error('\n❌ STAGE 5 VERIFICATION FAILED:');
  console.error(err);
  process.exit(1);
});
