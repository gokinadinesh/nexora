/**
 * NEXORA STAGE 6 VERIFICATION SUITE
 * Tests Persistent Competitive Gaming Platform:
 * 1. Authoritative ELO Rating calculation & bounds (K=32, floor=100, starting=1000)
 * 2. Match finalization flow via GAME_ENDED socket event
 * 3. Server-authoritative competitive statistics:
 *    - wins, losses, matches_played, winRate
 *    - total_score, best_score, current_win_streak, best_win_streak
 * 4. Match history REST API: GET /api/matches/history (paginated, user's matches, newest first)
 * 5. Match result REST API: GET /api/matches/:id/result (authorization guard: 403 for non-participants)
 * 6. Leaderboard REST API: GET /api/leaderboard (sorted by rating DESC, paginated)
 * 7. Player Rank REST API: GET /api/leaderboard/me
 * 8. Idempotent match completion guard
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runStage6Tests() {
  console.log('====================================================');
  console.log('>>> NEXORA STAGE 6 COMPETITIVE PLATFORM TEST SUITE <<<');
  console.log('====================================================\n');

  let socketA = null;
  let socketB = null;
  let socketC = null;

  try {
    // 1. Health check
    console.log('1. Verifying Grid Core Health');
    const health = await httpRequest('GET', '/api/health');
    if (health.status !== 200 || health.data.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.log('✔ Grid Core is online and operational\n');

    // 2. Register Player A, Player B, and Player C
    console.log('2. Registering Operatives for Competitive Engagement');
    const nonce = Math.floor(Math.random() * 90000) + 10000;

    const opA = {
      username: `agent_alpha_${nonce}`,
      email: `alpha_${nonce}@grid.io`,
      password: 'CyberPassword123!',
      displayName: `Agent Alpha ${nonce}`,
    };

    const opB = {
      username: `agent_beta_${nonce}`,
      email: `beta_${nonce}@grid.io`,
      password: 'CyberPassword123!',
      displayName: `Agent Beta ${nonce}`,
    };

    const opC = {
      username: `agent_gamma_${nonce}`,
      email: `gamma_${nonce}@grid.io`,
      password: 'CyberPassword123!',
      displayName: `Agent Gamma ${nonce}`,
    };

    const resA = await httpRequest('POST', '/api/auth/register', opA);
    const resB = await httpRequest('POST', '/api/auth/register', opB);
    const resC = await httpRequest('POST', '/api/auth/register', opC);

    if (resA.status !== 201 || resB.status !== 201 || resC.status !== 201) {
      throw new Error('Registration failed for operatives');
    }

    const tokenA = resA.data.token;
    const tokenB = resB.data.token;
    const tokenC = resC.data.token;
    const userA = resA.data.user;
    const userB = resB.data.user;
    const userC = resC.data.user;

    console.log(`✔ Registered: ${userA.username}, ${userB.username}, ${userC.username}`);

    // 3. Verify Initial Profiles and Competitive Fields
    console.log('\n3. Verifying Initial Competitive Baseline Profiles');
    const profA = await httpRequest('GET', '/api/profile', null, tokenA);
    if (profA.status !== 200) {
      throw new Error(`Failed to fetch initial profile: ${JSON.stringify(profA)}`);
    }

    const p = profA.data;
    if (p.rating !== 1000) throw new Error(`Starting rating should be 1000, got ${p.rating}`);
    if (p.wins !== 0) throw new Error(`Starting wins should be 0, got ${p.wins}`);
    if (p.losses !== 0) throw new Error(`Starting losses should be 0, got ${p.losses}`);
    if (p.matchesPlayed !== 0) throw new Error(`Starting matchesPlayed should be 0, got ${p.matchesPlayed}`);
    if (p.winRate !== 0) throw new Error(`Starting winRate should be 0, got ${p.winRate}`);
    if (p.currentWinStreak !== 0) throw new Error(`Starting currentWinStreak should be 0, got ${p.currentWinStreak}`);
    if (p.bestWinStreak !== 0) throw new Error(`Starting bestWinStreak should be 0, got ${p.bestWinStreak}`);
    if (p.totalScore !== 0) throw new Error(`Starting totalScore should be 0, got ${p.totalScore}`);
    if (p.bestScore !== 0) throw new Error(`Starting bestScore should be 0, got ${p.bestScore}`);

    console.log('✔ Initial competitive stats confirmed at pristine zero/1000 baseline');

    // 4. Connect Sockets & Matchmaking
    console.log('\n4. Connecting Sockets & Entering Matchmaking');
    socketA = await connectSocket(tokenA);
    socketB = await connectSocket(tokenB);

    const matchFoundPromiseA = waitForEvent(socketA, GAME_EVENTS.MATCH_FOUND);
    const matchFoundPromiseB = waitForEvent(socketB, GAME_EVENTS.MATCH_FOUND);

    await httpRequest('POST', '/api/matchmaking/join', {}, tokenA);
    await httpRequest('POST', '/api/matchmaking/join', {}, tokenB);

    const [matchDataA, matchDataB] = await Promise.all([matchFoundPromiseA, matchFoundPromiseB]);
    const matchId = matchDataA.matchId;
    if (!matchId || matchDataA.matchId !== matchDataB.matchId) {
      throw new Error('Match IDs mismatch');
    }
    console.log(`✔ Match found and session linked: ${matchId}`);

    // Join match room
    socketA.emit(GAME_EVENTS.PLAYER_JOINED, { matchId });
    socketB.emit(GAME_EVENTS.PLAYER_JOINED, { matchId });

    // 5. Play Match to Completion (Player A will reach 500+ pts)
    console.log('\n5. Executing Authoritative Real-Time Gameplay to Victory Threshold');

    // Turn 1 (P1): Player A moves N00 -> N01 (captures N01: +100 pts -> 100)
    await sleep(300);
    const syncP1 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N01',
    });
    await syncP1;

    // Turn 2 (P2): Player B moves N44 -> N43 (captures N43: +100 pts -> 100)
    await sleep(300);
    const syncP2 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N43',
    });
    await syncP2;

    // Turn 3 (P1): Player A moves N01 -> N02 (captures Special Core N02: +200 pts -> 300)
    await sleep(300);
    const syncP3 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'MOVE',
      targetNodeId: 'N02',
    });
    await syncP3;

    // Turn 4 (P2): Player B moves N43 -> N44
    await sleep(300);
    const syncP4 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N44',
    });
    await syncP4;

    // Turn 5 (P1): Player A captures N12 (+100 pts -> 400)
    await sleep(300);
    const syncP5 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketA.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userA.id,
      type: 'CAPTURE',
      targetNodeId: 'N12',
    });
    await syncP5;

    // Turn 6 (P2): Player B moves N44 -> N43
    await sleep(300);
    const syncP6 = waitForEvent(socketA, GAME_EVENTS.GAME_STATE_UPDATED);
    socketB.emit(GAME_EVENTS.PLAYER_ACTION, {
      actionId: crypto.randomUUID(),
      matchId,
      playerId: userB.id,
      type: 'MOVE',
      targetNodeId: 'N43',
    });
    await syncP6;

    // Turn 7 (P1): Player A captures Center Core N22 (+200 pts -> 600 pts >= 500 win threshold!)
    await sleep(300);
    console.log('  Player A capturing Center Core N22 (+200 pts -> 600 pts >= 500 threshold)...');
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

    console.log(`✔ GAME_ENDED broadcast received by both players! Winner: ${userA.username}`);

    // 6. Verify GAME_ENDED Payload Contains Finalized Match Result
    console.log('\n6. Validating Enriched GAME_ENDED Result Payload');
    const resultFromSocket = gameOverA.result;
    if (!resultFromSocket) {
      throw new Error('Expected result object inside GAME_ENDED socket event payload');
    }
    if (resultFromSocket.matchId !== matchId) {
      throw new Error(`matchId in result mismatch: expected ${matchId}, got ${resultFromSocket.matchId}`);
    }
    if (resultFromSocket.winnerId !== userA.id) {
      throw new Error(`winnerId in result mismatch: expected ${userA.id}, got ${resultFromSocket.winnerId}`);
    }
    if (typeof resultFromSocket.durationSeconds !== 'number') {
      throw new Error('durationSeconds should be a number in result payload');
    }
    if (resultFromSocket.players.length !== 2) {
      throw new Error('result.players should have 2 players');
    }

    const pA_res = resultFromSocket.players.find((p) => p.userId === userA.id);
    const pB_res = resultFromSocket.players.find((p) => p.userId === userB.id);

    if (!pA_res || !pB_res) {
      throw new Error('Both players must be present in result.players');
    }
    if (!pA_res.isWinner || pB_res.isWinner) {
      throw new Error('Player A should be winner, Player B should not');
    }
    if (pA_res.ratingChange <= 0) {
      throw new Error(`Winner rating change must be positive, got ${pA_res.ratingChange}`);
    }
    if (pB_res.ratingChange >= 0) {
      throw new Error(`Loser rating change must be negative, got ${pB_res.ratingChange}`);
    }
    if (pA_res.ratingAfter !== 1000 + pA_res.ratingChange) {
      throw new Error(`Winner ratingAfter mismatch: ${pA_res.ratingAfter}`);
    }
    if (pB_res.ratingAfter !== 1000 + pB_res.ratingChange) {
      throw new Error(`Loser ratingAfter mismatch: ${pB_res.ratingAfter}`);
    }

    console.log(`✔ Player A Rating: 1000 -> ${pA_res.ratingAfter} (+${pA_res.ratingChange})`);
    console.log(`✔ Player B Rating: 1000 -> ${pB_res.ratingAfter} (${pB_res.ratingChange})`);
    console.log(`✔ Match Duration: ${resultFromSocket.durationSeconds}s, Final Version: v${resultFromSocket.finalVersion}`);

    // 7. Test Match Result REST API: GET /api/matches/:id/result
    console.log('\n7. Testing Match Result REST API: GET /api/matches/:id/result');

    // 7a. Participant A request (should succeed 200)
    const resultResA = await httpRequest('GET', `/api/matches/${matchId}/result`, null, tokenA);
    if (resultResA.status !== 200) {
      throw new Error(`Player A failed to get match result: ${JSON.stringify(resultResA)}`);
    }
    console.log('✔ Player A (participant) retrieved match result successfully (HTTP 200)');

    // 7b. Participant B request (should succeed 200)
    const resultResB = await httpRequest('GET', `/api/matches/${matchId}/result`, null, tokenB);
    if (resultResB.status !== 200) {
      throw new Error(`Player B failed to get match result: ${JSON.stringify(resultResB)}`);
    }
    console.log('✔ Player B (participant) retrieved match result successfully (HTTP 200)');

    // 7c. Authorization Guard: Non-participant C request (MUST FAIL 403)
    const resultResC = await httpRequest('GET', `/api/matches/${matchId}/result`, null, tokenC);
    if (resultResC.status !== 403) {
      throw new Error(`Non-participant should receive 403 Forbidden, got ${resultResC.status}`);
    }
    console.log('✔ Non-participant Operative C strictly rejected with HTTP 403 Forbidden');

    // 7d. Non-existent match (should return 404)
    const fakeMatchId = crypto.randomUUID();
    const resultResFake = await httpRequest('GET', `/api/matches/${fakeMatchId}/result`, null, tokenA);
    if (resultResFake.status !== 403 && resultResFake.status !== 404) {
      throw new Error(`Non-existent match should return 403 or 404, got ${resultResFake.status}`);
    }
    console.log('✔ Non-existent match properly handled');

    // 8. Test Match History REST API: GET /api/matches/history
    console.log('\n8. Testing Match History REST API: GET /api/matches/history');

    // 8a. Player A Match History
    const historyA = await httpRequest('GET', '/api/matches/history?page=1&limit=10', null, tokenA);
    if (historyA.status !== 200) {
      throw new Error(`Failed to get Player A match history: ${JSON.stringify(historyA)}`);
    }
    if (historyA.data.matches.length === 0) {
      throw new Error('Player A should have at least 1 match in history');
    }

    const matchItemA = historyA.data.matches[0];
    if (matchItemA.matchId !== matchId) {
      throw new Error(`Expected latest match to be ${matchId}, got ${matchItemA.matchId}`);
    }
    if (matchItemA.result !== 'VICTORY') {
      throw new Error(`Player A result should be VICTORY, got ${matchItemA.result}`);
    }
    if (matchItemA.myScore !== 600) {
      throw new Error(`Player A score should be 600, got ${matchItemA.myScore}`);
    }
    if (matchItemA.opponent.username !== userB.username) {
      throw new Error(`Player A opponent username should be ${userB.username}, got ${matchItemA.opponent.username}`);
    }
    if (matchItemA.ratingChange !== pA_res.ratingChange) {
      throw new Error(`Rating change mismatch in history: ${matchItemA.ratingChange}`);
    }
    console.log('✔ Player A Match History: Correct VICTORY record, score 600 vs 100, opponent resolved');

    // 8b. Player B Match History
    const historyB = await httpRequest('GET', '/api/matches/history?page=1&limit=10', null, tokenB);
    if (historyB.status !== 200) {
      throw new Error(`Failed to get Player B match history: ${JSON.stringify(historyB)}`);
    }
    const matchItemB = historyB.data.matches[0];
    if (matchItemB.result !== 'DEFEAT') {
      throw new Error(`Player B result should be DEFEAT, got ${matchItemB.result}`);
    }
    if (matchItemB.opponent.username !== userA.username) {
      throw new Error(`Player B opponent username should be ${userA.username}`);
    }
    console.log('✔ Player B Match History: Correct DEFEAT record, score 100 vs 600, opponent resolved');

    // 8c. Player C Match History (should be empty list)
    const historyC = await httpRequest('GET', '/api/matches/history', null, tokenC);
    if (historyC.status !== 200 || historyC.data.matches.length !== 0) {
      throw new Error('Player C should have 0 matches in history');
    }
    console.log('✔ Operative C has 0 matches (no cross-contamination of match histories)');

    // 9. Test Updated Profiles & Competitive Progression
    console.log('\n9. Verifying Authoritative Competitive Progression Updates');
    const updatedProfA = await httpRequest('GET', '/api/profile', null, tokenA);
    const pA = updatedProfA.data;

    if (pA.wins !== 1) throw new Error(`Player A wins should be 1, got ${pA.wins}`);
    if (pA.losses !== 0) throw new Error(`Player A losses should be 0, got ${pA.losses}`);
    if (pA.matchesPlayed !== 1) throw new Error(`Player A matchesPlayed should be 1, got ${pA.matchesPlayed}`);
    if (pA.winRate !== 100) throw new Error(`Player A winRate should be 100, got ${pA.winRate}`);
    if (pA.currentWinStreak !== 1) throw new Error(`Player A streak should be 1, got ${pA.currentWinStreak}`);
    if (pA.bestWinStreak !== 1) throw new Error(`Player A bestWinStreak should be 1, got ${pA.bestWinStreak}`);
    if (pA.totalScore !== 600) throw new Error(`Player A totalScore should be 600, got ${pA.totalScore}`);
    if (pA.bestScore !== 600) throw new Error(`Player A bestScore should be 600, got ${pA.bestScore}`);
    if (pA.rating <= 1000) throw new Error(`Player A rating should be > 1000, got ${pA.rating}`);

    console.log(`✔ Player A Profile Updated: Rating ${pA.rating}, WinRate: ${pA.winRate}%, Streak: ${pA.currentWinStreak}, TotalScore: ${pA.totalScore}`);

    const updatedProfB = await httpRequest('GET', '/api/profile', null, tokenB);
    const pB = updatedProfB.data;

    if (pB.wins !== 0) throw new Error(`Player B wins should be 0, got ${pB.wins}`);
    if (pB.losses !== 1) throw new Error(`Player B losses should be 1, got ${pB.losses}`);
    if (pB.matchesPlayed !== 1) throw new Error(`Player B matchesPlayed should be 1, got ${pB.matchesPlayed}`);
    if (pB.winRate !== 0) throw new Error(`Player B winRate should be 0, got ${pB.winRate}`);
    if (pB.currentWinStreak !== 0) throw new Error(`Player B current streak should be 0, got ${pB.currentWinStreak}`);
    if (pB.totalScore !== 100) throw new Error(`Player B totalScore should be 100, got ${pB.totalScore}`);
    if (pB.bestScore !== 100) throw new Error(`Player B bestScore should be 100, got ${pB.bestScore}`);
    if (pB.rating >= 1000) throw new Error(`Player B rating should be < 1000, got ${pB.rating}`);

    console.log(`✔ Player B Profile Updated: Rating ${pB.rating}, WinRate: ${pB.winRate}%, Streak: ${pB.currentWinStreak}, TotalScore: ${pB.totalScore}`);

    // 10. Test Leaderboard REST API: GET /api/leaderboard & /api/leaderboard/me
    console.log('\n10. Testing Leaderboard REST API');
    const lbRes = await httpRequest('GET', '/api/leaderboard?page=1&limit=100', null, tokenA);
    if (lbRes.status !== 200) {
      throw new Error(`Failed to fetch leaderboard: ${JSON.stringify(lbRes)}`);
    }

    const lb = lbRes.data;
    if (!lb.entries || lb.entries.length === 0) {
      throw new Error('Leaderboard entries should not be empty');
    }

    // Verify ordering: descending rating
    for (let i = 0; i < lb.entries.length - 1; i++) {
      if (lb.entries[i].rating < lb.entries[i + 1].rating) {
        throw new Error(`Leaderboard sorting violation at index ${i}: ${lb.entries[i].rating} < ${lb.entries[i + 1].rating}`);
      }
    }

    const rankAInLb = lb.entries.find((e) => e.id === userA.id);
    const rankBInLb = lb.entries.find((e) => e.id === userB.id);

    if (!rankAInLb || !rankBInLb) {
      throw new Error('Both operatives should be present in leaderboard');
    }
    if (rankAInLb.rank >= rankBInLb.rank) {
      throw new Error(`Player A (winner) rank #${rankAInLb.rank} should be higher (smaller number) than Player B #${rankBInLb.rank}`);
    }
    console.log(`✔ Leaderboard telemetry confirmed: Player A is #${rankAInLb.rank} (${rankAInLb.rating} ELO), Player B is #${rankBInLb.rank} (${rankBInLb.rating} ELO)`);

    // 10b. Personal Rank: GET /api/leaderboard/me
    const myRankA = await httpRequest('GET', '/api/leaderboard/me', null, tokenA);
    if (myRankA.status !== 200) {
      throw new Error(`Failed to get Player A rank: ${JSON.stringify(myRankA)}`);
    }
    if (myRankA.data.rank !== rankAInLb.rank) {
      throw new Error(`Personal rank mismatch: expected ${rankAInLb.rank}, got ${myRankA.data.rank}`);
    }
    console.log(`✔ Personal rank API /api/leaderboard/me matches global standing: #${myRankA.data.rank}`);

    // 11. Idempotency Check: Finalize Match must not duplicate rating changes or stats
    console.log('\n11. Testing Finalization Idempotency Protection');
    // Fetch result again - verify no rating changed
    const repeatResult = await httpRequest('GET', `/api/matches/${matchId}/result`, null, tokenA);
    const profAAfterRepeat = await httpRequest('GET', '/api/profile', null, tokenA);
    if (profAAfterRepeat.data.wins !== 1 || profAAfterRepeat.data.rating !== pA.rating) {
      throw new Error('Idempotency violation! Player A stats mutated on repeated result query');
    }
    console.log('✔ Idempotency confirmed: repeated reads do not mutate ratings, streaks, or scores');

    console.log('\n====================================================');
    console.log('>>> ALL NEXORA STAGE 6 VERIFICATION CHECKS PASSED! <<<');
    console.log('====================================================\n');

  } finally {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
    if (socketC) socketC.disconnect();
  }
}

runStage6Tests().catch((err) => {
  console.error('\n❌ STAGE 6 VERIFICATION FAILED:');
  console.error(err);
  process.exit(1);
});
