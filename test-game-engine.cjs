const assert = require('assert');
const { createInitialGameState } = require('./server/dist/game/game-state');
const { isAdjacent, validateTurn, validateMove } = require('./server/dist/game/game-rules');
const { executeAction } = require('./server/dist/game/game-actions');
const { GameEngine } = require('./server/dist/game/game-engine');

console.log('\n======================================================');
console.log('--- NEXORA STAGE 5: GAME ENGINE PURE MECHANICS TESTS ---');
console.log('======================================================\n');

let passedTests = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runPureTests() {
  const p1 = { id: 'player-uuid-1', displayName: 'Operative_One', rating: 1000 };
  const p2 = { id: 'player-uuid-2', displayName: 'Operative_Two', rating: 1000 };
  const matchId = 'match-uuid-100';

  await test('1. Initial Game State Generation (5x5 grid, 25 nodes, special nodes)', () => {
    const state = createInitialGameState(matchId, p1, p2);
    assert.strictEqual(state.matchId, matchId);
    assert.strictEqual(state.version, 1);
    assert.strictEqual(state.turnNumber, 1);
    assert.strictEqual(state.turnPlayerId, p1.id);
    assert.strictEqual(state.winnerId, null);

    const nodeKeys = Object.keys(state.grid);
    assert.strictEqual(nodeKeys.length, 25, 'Grid must have exactly 25 nodes (N00..N44)');
    assert(nodeKeys.includes('N00') && nodeKeys.includes('N44') && nodeKeys.includes('N22'));

    // Check special nodes
    const specialNodes = ['N22', 'N02', 'N42', 'N20', 'N24'];
    for (const sid of specialNodes) {
      assert.strictEqual(state.grid[sid].type, 'SPECIAL', `Node ${sid} should be SPECIAL`);
    }

    // Check starting positions
    assert.strictEqual(state.players[p1.id].position, 'N00');
    assert.strictEqual(state.players[p1.id].role, 'PLAYER_1');
    assert.strictEqual(state.players[p1.id].score, 0);
    assert.strictEqual(state.grid['N00'].owner, 'PLAYER_1');

    assert.strictEqual(state.players[p2.id].position, 'N44');
    assert.strictEqual(state.players[p2.id].role, 'PLAYER_2');
    assert.strictEqual(state.players[p2.id].score, 0);
    assert.strictEqual(state.grid['N44'].owner, 'PLAYER_2');
  });

  await test('2. Strict Manhattan Adjacency Validation', () => {
    const state = createInitialGameState(matchId, p1, p2);

    // From N00: N01 is adjacent (dx=0, dy=1 -> 1)
    assert.strictEqual(isAdjacent('N00', 'N01'), true);
    assert.strictEqual(isAdjacent('N00', 'N10'), true);

    // Diagonal N11 (dx=1, dy=1 -> 2) must be false
    assert.strictEqual(isAdjacent('N00', 'N11'), false);

    // Jump N02 (dx=0, dy=2 -> 2) must be false
    assert.strictEqual(isAdjacent('N00', 'N02'), false);

    // validateMove from N00 to N01 succeeds
    const targetNode = validateMove(state, p1.id, 'N01');
    assert.strictEqual(targetNode.id, 'N01');

    // validateMove to diagonal N11 throws INVALID_MOVE
    let caughtDiag = false;
    try {
      validateMove(state, p1.id, 'N11');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_MOVE');
      caughtDiag = true;
    }
    assert.strictEqual(caughtDiag, true);
  });

  await test('3. Out of Turn Action Validation', () => {
    const state = createInitialGameState(matchId, p1, p2);
    // P2 tries to act on turn 1 (which belongs to P1)
    let caughtTurn = false;
    try {
      validateTurn(state, p2.id);
    } catch (err) {
      assert.strictEqual(err.code, 'NOT_YOUR_TURN');
      caughtTurn = true;
    }
    assert.strictEqual(caughtTurn, true);
  });

  await test('4. Move to Neutral Node Automatically Captures & Awards Points', () => {
    const state = createInitialGameState(matchId, p1, p2);
    const result = executeAction(state, p1.id, 'MOVE', 'N01');

    assert.strictEqual(result.type, 'CAPTURE');
    assert.strictEqual(state.players[p1.id].position, 'N01');
    assert.strictEqual(state.grid['N01'].owner, 'PLAYER_1');
    assert.strictEqual(state.players[p1.id].score, 100, 'Capturing normal neutral node gives 100 pts');
  });

  await test('5. Capturing Special Core Node Awards 200 Points', () => {
    const state = createInitialGameState(matchId, p1, p2);
    // Set P1 adjacent to N02 (e.g. at N01)
    state.players[p1.id].position = 'N01';
    state.grid['N01'].owner = 'PLAYER_1';

    const result = executeAction(state, p1.id, 'CAPTURE', 'N02');

    assert.strictEqual(result.type, 'CAPTURE');
    assert.strictEqual(state.players[p1.id].score, 200, 'Capturing SPECIAL node gives 200 pts');
    assert.strictEqual(state.grid['N02'].owner, 'PLAYER_1');
  });

  await test('6. Defense Activation & Attack Shield Breach Mechanics', () => {
    const state = createInitialGameState(matchId, p1, p2);
    // P1 defends N00
    const defResult = executeAction(state, p1.id, 'DEFEND', 'N00');
    assert.strictEqual(defResult.type, 'DEFEND');
    assert.strictEqual(state.grid['N00'].isDefended, true);

    // Place P2 at N01 adjacent to N00 and make it P2's turn
    state.players[p2.id].position = 'N01';
    state.grid['N01'].owner = 'PLAYER_2';
    state.turnPlayerId = p2.id;

    // P2 attacks P1's defended node N00
    const atk1Result = executeAction(state, p2.id, 'ATTACK', 'N00');

    // Shield should be breached, but node still owned by P1
    assert.strictEqual(state.grid['N00'].isDefended, false, 'Shield should be breached');
    assert.strictEqual(state.grid['N00'].owner, 'PLAYER_1', 'Node remains with P1 after first attack on shield');
    assert.strictEqual(atk1Result.scoreDelta, 25, 'Breaching shield awards 25 points');

    // Second attack breaches node ownership
    const atk2Result = executeAction(state, p2.id, 'ATTACK', 'N00');

    assert.strictEqual(state.grid['N00'].owner, 'PLAYER_2', 'Node ownership captured after unshielded attack');
    assert.strictEqual(atk2Result.scoreDelta, 50, 'Attacking enemy node awards 50 points');
    assert.strictEqual(state.players[p2.id].score, 75, 'Total score awards 25 (shield) + 50 (capture) = 75 points');
  });

  await test('7. GameEngine Idempotency & Rate Limiting Integration', async () => {
    const engine = new GameEngine();

    engine.initGame(matchId, p1, p2);

    // Valid action 1
    const res1 = await engine.processAction(
      matchId,
      p1.id,
      {
        actionId: 'unique-1',
        matchId,
        playerId: p1.id,
        type: 'MOVE',
        targetNodeId: 'N01',
      }
    );

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.state.version, 2);
    assert.strictEqual(res1.state.turnNumber, 2);
    assert.strictEqual(res1.state.turnPlayerId, p2.id);

    // Rate limiting: P1 rapidly tries another action within 250ms
    let rateLimitCaught = false;
    try {
      await engine.processAction(
        matchId,
        p1.id,
        {
          actionId: 'unique-2',
          matchId,
          playerId: p1.id,
          type: 'MOVE',
          targetNodeId: 'N02',
        }
      );
    } catch (err) {
      assert.strictEqual(err.code, 'RATE_LIMITED');
      rateLimitCaught = true;
    }
    assert.strictEqual(rateLimitCaught, true, 'Action within 250ms must be rejected with RATE_LIMITED');

    // Duplicate actionId replay attack
    let duplicateCaught = false;
    try {
      await engine.processAction(
        matchId,
        p2.id,
        {
          actionId: 'unique-1', // same actionId!
          matchId,
          playerId: p2.id,
          type: 'MOVE',
          targetNodeId: 'N43',
        }
      );
    } catch (err) {
      assert.strictEqual(err.code, 'DUPLICATE_ACTION');
      duplicateCaught = true;
    }
    assert.strictEqual(duplicateCaught, true, 'Duplicate actionId must be rejected with DUPLICATE_ACTION');
  });

  await test('8. Win Condition: Reaching >= 500 Points Ends Game Authoritatively', async () => {
    const engine = new GameEngine();

    const initial = engine.initGame(matchId, p1, p2);
    // Give P1 450 points
    initial.players[p1.id].score = 450;

    // Wait 260ms to clear any cooldown
    await new Promise((r) => setTimeout(r, 260));

    // P1 captures normal node (+100) -> 550 points!
    const res = await engine.processAction(
      matchId,
      p1.id,
      {
        actionId: 'win-act',
        matchId,
        playerId: p1.id,
        type: 'CAPTURE',
        targetNodeId: 'N01',
      }
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isGameOver, true);
    assert.strictEqual(res.winnerId, p1.id);
    assert.strictEqual(res.state.winnerId, p1.id);
    assert.strictEqual(res.state.players[p1.id].score, 550);
  });

  console.log(`\n>>> ALL ${passedTests} PURE GAME ENGINE MECHANICS TESTS PASSED! <<<\n`);
}

runPureTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
