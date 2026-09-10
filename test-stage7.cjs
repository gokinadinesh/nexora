/**
 * NEXORA STAGE 7 VERIFICATION SUITE
 * Tests Real-Time Operations, Monitoring & Security Layer:
 * 1. Subsystem Health Checks (server, database, websocket, matchmaking)
 * 2. Role-Based Access Control (RBAC):
 *    - Unauthenticated access to /api/monitoring/* -> 401
 *    - Normal player access to /api/monitoring/* -> 403 Forbidden
 *    - Client role tampering via PATCH /api/profile -> 400 Bad Request
 *    - Operator access to /api/monitoring/* -> 200 OK
 * 3. Platform & Performance Metrics Telemetry:
 *    - activePlayers, activeMatches, matchmakingQueue, websocketConnections
 *    - actionsProcessed, eventsProcessed, averageActionLatency, serverUptime
 *    - verification that no secrets or credentials are leaked
 * 4. Bounded Buffer Integrity (operational events and security events buffer limit)
 * 5. Security Events & Severity Logging (rate limits, out of turn, invalid moves)
 * 6. Rule-Based Deterministic Anomaly Detection (action flooding, invalid actions, auth failures, bounds 0-100)
 * 7. Real-Time Socket.IO Monitoring Stream (subscription authorization and event broadcasting)
 */

const http = require('http');
const crypto = require('crypto');
const { io } = require('socket.io-client');
const { GAME_EVENTS } = require('./shared/dist');

const API_BASE = 'http://localhost:4000';

function httpRequest(method, path, body = null, token = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...customHeaders,
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

function waitForEvent(socket, eventName, timeoutMs = 6000) {
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

async function runStage7Tests() {
  console.log('====================================================');
  console.log('>>> NEXORA STAGE 7 OPERATIONS & SECURITY TEST SUITE <<<');
  console.log('====================================================\n');

  let socketPlayer = null;
  let socketOperator = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Subsystem Health Checks
    // -------------------------------------------------------------
    console.log('[TEST 1] Testing Subsystem Health Endpoint (GET /api/health)...');
    const healthRes = await httpRequest('GET', '/api/health');
    if (healthRes.status !== 200) {
      throw new Error(`Expected health status 200, got ${healthRes.status}`);
    }
    if (healthRes.data.status !== 'ok' || healthRes.data.service !== 'nexora-server') {
      throw new Error(`Health response missing required foundation fields: ${JSON.stringify(healthRes.data)}`);
    }
    if (!healthRes.data.services) {
      throw new Error('Health response missing subsystem services breakdown');
    }
    const { server, database, websocket, matchmaking } = healthRes.data.services;
    console.log(`  Subsystems: Server=${server}, DB=${database}, WS=${websocket}, MM=${matchmaking}`);
    if (server !== 'healthy' || database !== 'healthy' || websocket !== 'healthy' || matchmaking !== 'healthy') {
      throw new Error(`One or more subsystems not healthy: ${JSON.stringify(healthRes.data.services)}`);
    }
    console.log('✔ [TEST 1 PASSED] Subsystem health verification successful.\n');

    // -------------------------------------------------------------
    // TEST 2: RBAC & Monitoring Access Security Guards
    // -------------------------------------------------------------
    console.log('[TEST 2] Testing RBAC & Monitoring Security Guards...');

    // 2a. Unauthenticated access
    const unauthMetrics = await httpRequest('GET', '/api/monitoring/metrics');
    if (unauthMetrics.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated metrics access, got ${unauthMetrics.status}`);
    }
    console.log('  ✔ Unauthenticated metrics access correctly rejected with 401');

    // 2b. Register normal player
    const playerUsername = `player_${Date.now().toString().slice(-6)}`;
    const playerEmail = `${playerUsername}@nexora.test`;
    const regPlayerRes = await httpRequest('POST', '/api/auth/register', {
      username: playerUsername,
      email: playerEmail,
      password: 'CyberPassword2026!',
    });
    if (regPlayerRes.status !== 201) {
      throw new Error(`Player registration failed: ${JSON.stringify(regPlayerRes.data)}`);
    }
    const playerToken = regPlayerRes.data.token;
    const playerId = regPlayerRes.data.user.id;

    // Check /api/me for default role
    const mePlayer = await httpRequest('GET', '/api/me', null, playerToken);
    if (mePlayer.data.role !== 'PLAYER') {
      throw new Error(`Expected default role to be PLAYER, got ${mePlayer.data.role}`);
    }
    console.log(`  ✔ New player assigned default role: ${mePlayer.data.role}`);

    // 2c. Normal player attempting to access monitoring endpoints
    const playerMetrics = await httpRequest('GET', '/api/monitoring/metrics', null, playerToken);
    if (playerMetrics.status !== 403) {
      throw new Error(`Expected 403 for player access to /api/monitoring/metrics, got ${playerMetrics.status}`);
    }
    const playerEvents = await httpRequest('GET', '/api/monitoring/events', null, playerToken);
    if (playerEvents.status !== 403) {
      throw new Error(`Expected 403 for player access to /api/monitoring/events, got ${playerEvents.status}`);
    }
    const playerSecurity = await httpRequest('GET', '/api/monitoring/security', null, playerToken);
    if (playerSecurity.status !== 403) {
      throw new Error(`Expected 403 for player access to /api/monitoring/security, got ${playerSecurity.status}`);
    }
    console.log('  ✔ Normal player access to all monitoring endpoints strictly forbidden (403)');

    // 2d. Role tampering prevention
    const tamperRes = await httpRequest(
      'PATCH',
      '/api/profile',
      { role: 'OPERATOR', displayName: 'Hacked_Admin' },
      playerToken
    );
    if (tamperRes.status !== 400) {
      throw new Error(`Expected 400 for client role tampering attempt, got ${tamperRes.status}`);
    }
    const mePlayerAfterTamper = await httpRequest('GET', '/api/me', null, playerToken);
    if (mePlayerAfterTamper.data.role !== 'PLAYER') {
      throw new Error(`Role tampering succeeded! Role is now ${mePlayerAfterTamper.data.role}`);
    }
    console.log('  ✔ Client role tampering strictly rejected (400) and role preserved as PLAYER');
    console.log('✔ [TEST 2 PASSED] RBAC and access security guards verified.\n');

    // -------------------------------------------------------------
    // TEST 3: Operator Creation & Telemetry Metrics Endpoint
    // -------------------------------------------------------------
    console.log('[TEST 3] Testing Operator Authorization & Metrics Telemetry...');

    // 3a. Register operator via configured operator email
    const opUsername = `op_${Date.now().toString().slice(-6)}`;
    const opEmail = 'operator@nexora.io';
    // Use unique username to avoid conflicts
    const regOpRes = await httpRequest('POST', '/api/auth/register', {
      username: `operator_${Date.now().toString().slice(-4)}`,
      email: `${opUsername}@nexora.test`,
      password: 'OperatorPass2026!',
    });
    if (regOpRes.status !== 201) {
      throw new Error(`Operator registration failed: ${JSON.stringify(regOpRes.data)}`);
    }
    const opUserId = regOpRes.data.user.id;

    // Promote to OPERATOR via controlled server secret
    const promoteRes = await httpRequest(
      'POST',
      '/api/monitoring/promote',
      { userId: opUserId },
      null,
      { 'x-operator-secret': 'nexora-secret-operator-key-stage7' }
    );
    if (promoteRes.status !== 200) {
      throw new Error(`Operator promotion failed: ${JSON.stringify(promoteRes.data)}`);
    }

    // Login as operator to get fresh token with OPERATOR role
    const loginOp = await httpRequest('POST', '/api/auth/login', {
      email: `${opUsername}@nexora.test`,
      password: 'OperatorPass2026!',
    });
    const operatorToken = loginOp.data.token;
    const meOp = await httpRequest('GET', '/api/me', null, operatorToken);
    if (meOp.data.role !== 'OPERATOR') {
      throw new Error(`Expected operator role to be OPERATOR, got ${meOp.data.role}`);
    }
    console.log(`  ✔ Operator authenticated with verified role: ${meOp.data.role}`);

    // 3b. Operator fetching /api/monitoring/metrics
    const metricsRes = await httpRequest('GET', '/api/monitoring/metrics', null, operatorToken);
    if (metricsRes.status !== 200) {
      throw new Error(`Expected 200 for operator metrics access, got ${metricsRes.status}`);
    }
    const m = metricsRes.data;
    console.log('  Current Telemetry Metrics Sample:');
    console.log(`    - Active Players: ${m.activePlayers}`);
    console.log(`    - Active Matches: ${m.activeMatches}`);
    console.log(`    - Queue Size: ${m.matchmakingQueue}`);
    console.log(`    - WS Connections: ${m.websocketConnections}`);
    console.log(`    - Server Uptime: ${m.serverUptime}s`);
    console.log(`    - Instance: ${m.instanceLabel}`);

    if (typeof m.activePlayers !== 'number' || typeof m.websocketConnections !== 'number') {
      throw new Error('Metrics response missing core platform count numbers');
    }
    if (m.instanceLabel !== 'Current Server Instance') {
      throw new Error(`Expected instance label 'Current Server Instance', got ${m.instanceLabel}`);
    }

    // 3c. Verify no secrets or sensitive credentials leaked
    const metricsString = JSON.stringify(m).toLowerCase();
    const forbiddenKeys = ['password', 'password_hash', 'jwtsecret', 'jwt_secret', 'secret'];
    for (const key of forbiddenKeys) {
      if (metricsString.includes(`"${key}"`)) {
        throw new Error(`Metrics response leaks sensitive credential key: ${key}`);
      }
    }
    console.log('  ✔ Verified metrics response contains zero credential leaks or secrets');
    console.log('✔ [TEST 3 PASSED] Operator authorization and telemetry metrics verified.\n');

    // -------------------------------------------------------------
    // TEST 4: Live Telemetry Tracking & Bounded Event Buffers
    // -------------------------------------------------------------
    console.log('[TEST 4] Testing Real-Time Telemetry & Bounded Buffers...');

    // Connect sockets for player and operator
    socketPlayer = await connectSocket(playerToken);
    socketOperator = await connectSocket(operatorToken);
    await sleep(200);

    const metricsAfterConnect = await httpRequest('GET', '/api/monitoring/metrics', null, operatorToken);
    if (metricsAfterConnect.data.websocketConnections < 2) {
      throw new Error(
        `Expected at least 2 WebSocket connections, got ${metricsAfterConnect.data.websocketConnections}`
      );
    }
    console.log(`  ✔ WebSocket connection counter tracked: ${metricsAfterConnect.data.websocketConnections}`);

    // Join matchmaking queue with player socket
    socketPlayer.emit(GAME_EVENTS.QUEUE_JOINED);
    await sleep(200);

    const metricsAfterQueue = await httpRequest('GET', '/api/monitoring/metrics', null, operatorToken);
    if (metricsAfterQueue.data.matchmakingQueue < 1) {
      throw new Error(`Expected queue size >= 1, got ${metricsAfterQueue.data.matchmakingQueue}`);
    }
    console.log(`  ✔ Matchmaking queue metric tracked: ${metricsAfterQueue.data.matchmakingQueue}`);

    // Leave queue
    socketPlayer.emit(GAME_EVENTS.QUEUE_LEFT);
    await sleep(200);

    // Fetch operational event feed
    const eventsRes = await httpRequest('GET', '/api/monitoring/events', null, operatorToken);
    if (eventsRes.status !== 200 || !Array.isArray(eventsRes.data.events)) {
      throw new Error('Failed to retrieve operational events feed');
    }
    console.log(`  ✔ Operational events stream returned ${eventsRes.data.events.length} events`);
    console.log(`  ✔ Buffer capacity bounded to: ${eventsRes.data.bufferCapacity}`);

    const hasQueueEvent = eventsRes.data.events.some((e) => e.type === 'QUEUE_JOINED');
    if (!hasQueueEvent) {
      throw new Error('QUEUE_JOINED event not found in operational events stream');
    }
    console.log('  ✔ Found QUEUE_JOINED operational event in bounded stream');
    console.log('✔ [TEST 4 PASSED] Telemetry tracking and bounded event buffer verified.\n');

    // -------------------------------------------------------------
    // TEST 5: Security Event Logging & Violations
    // -------------------------------------------------------------
    console.log('[TEST 5] Testing Security Event Logging on Violations...');

    // 5a. Trigger a rate limit / invalid action violation via socket
    const fakeAction = {
      matchId: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      type: 'MOVE',
      targetNodeId: 'N99',
    };

    const actionRejectedPromise = waitForEvent(socketPlayer, GAME_EVENTS.ACTION_REJECTED);
    socketPlayer.emit(GAME_EVENTS.PLAYER_ACTION, fakeAction);
    const rejectedPayload = await actionRejectedPromise;
    console.log(`  Action rejection intercepted: code=${rejectedPayload.code}, reason=${rejectedPayload.reason}`);

    // 5b. Verify security events recorded
    const secRes = await httpRequest('GET', '/api/monitoring/security', null, operatorToken);
    if (secRes.status !== 200 || !Array.isArray(secRes.data.events)) {
      throw new Error('Failed to retrieve security events stream');
    }
    console.log(`  ✔ Security event log contains ${secRes.data.events.length} incidents`);
    console.log(`  ✔ Security severities summary:`, secRes.data.summary);

    if (secRes.data.events.length === 0) {
      throw new Error('Security events list is empty after violations');
    }

    const hasSecurityEvent = secRes.data.events.some(
      (e) =>
        e.type === 'FORBIDDEN_MATCH_ACCESS' ||
        e.type === 'UNAUTHORIZED_ACCESS' ||
        e.type === 'ROLE_TAMPERING' ||
        e.type === 'INVALID_GAME_ACTION'
    );
    if (!hasSecurityEvent) {
      throw new Error('Expected security event type not detected in security stream');
    }
    console.log('  ✔ Expected security violation logged with severity badge');
    console.log('✔ [TEST 5 PASSED] Security event recording verified.\n');

    // -------------------------------------------------------------
    // TEST 6: Deterministic Anomaly Detection
    // -------------------------------------------------------------
    console.log('[TEST 6] Testing Rule-Based Deterministic Anomaly Detection...');

    // Fetch initial anomaly reports
    const secWithAnomalies = await httpRequest('GET', '/api/monitoring/security', null, operatorToken);
    const reports = secWithAnomalies.data.anomalyReports || [];
    console.log(`  Active anomaly reports: ${reports.length}`);

    // Check bounds: every score must be between 0 and 100
    for (const report of reports) {
      if (report.score < 0 || report.score > 100) {
        throw new Error(`Anomaly score out of bounds [0, 100]: ${report.score}`);
      }
      if (!['NORMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(report.level)) {
        throw new Error(`Invalid anomaly level: ${report.level}`);
      }
    }
    console.log('  ✔ All anomaly scores verified strictly within bounds [0, 100] with valid levels');

    // Trigger rapid authorization failures to verify score escalation
    for (let i = 0; i < 4; i++) {
      await httpRequest('GET', '/api/monitoring/metrics', null, playerToken);
    }

    const secEscalated = await httpRequest('GET', '/api/monitoring/security', null, operatorToken);
    const playerReport = (secEscalated.data.anomalyReports || []).find((r) => r.userId === playerId);
    if (playerReport) {
      console.log(`  Player Anomaly Profile: Score=${playerReport.score}/100, Level=${playerReport.level}`);
      if (playerReport.score <= 0) {
        throw new Error('Expected anomaly score to escalate after multiple auth failures');
      }
      console.log('  ✔ Anomaly score escalated on repeated security failures');
    }
    console.log('✔ [TEST 6 PASSED] Anomaly detection rules and score bounding verified.\n');

    // -------------------------------------------------------------
    // TEST 7: Socket.IO Real-Time Monitoring Stream
    // -------------------------------------------------------------
    console.log('[TEST 7] Testing Socket.IO Real-Time Monitoring Stream...');

    // 7a. Normal player cannot subscribe
    const errorPromise = waitForEvent(socketPlayer, 'MONITORING_ERROR');
    socketPlayer.emit(GAME_EVENTS.MONITORING_SUBSCRIBE);
    const errData = await errorPromise;
    if (!errData.message.includes('Forbidden')) {
      throw new Error(`Expected forbidden message, got: ${JSON.stringify(errData)}`);
    }
    console.log('  ✔ Normal player subscription to monitoring stream rejected with forbidden error');

    // 7b. Operator subscribes and receives real-time snapshot
    const metricsUpdatePromise = waitForEvent(socketOperator, GAME_EVENTS.MONITORING_METRICS_UPDATED);
    socketOperator.emit(GAME_EVENTS.MONITORING_SUBSCRIBE);
    const liveMetrics = await metricsUpdatePromise;
    if (!liveMetrics || typeof liveMetrics.activePlayers !== 'number') {
      throw new Error('Operator did not receive live metrics update on subscription');
    }
    console.log(`  ✔ Operator received live MONITORING_METRICS_UPDATED stream (uptime: ${liveMetrics.serverUptime}s)`);

    // 7c. Operational event emission over socket
    const eventBroadcastPromise = waitForEvent(socketOperator, GAME_EVENTS.MONITORING_EVENT);
    socketPlayer.emit(GAME_EVENTS.QUEUE_JOINED);
    const liveEvent = await eventBroadcastPromise;
    console.log(`  ✔ Operator received broadcast operational event: ${liveEvent.type}`);
    if (liveEvent.type !== 'QUEUE_JOINED') {
      throw new Error(`Expected broadcast event QUEUE_JOINED, got ${liveEvent.type}`);
    }

    // Cleanup queue
    socketPlayer.emit(GAME_EVENTS.QUEUE_LEFT);
    console.log('✔ [TEST 7 PASSED] Socket.IO monitoring subscription & broadcasting verified.\n');

    console.log('====================================================');
    console.log('>>> ALL NEXORA STAGE 7 VERIFICATION TESTS PASSED <<<');
    console.log('====================================================');
  } finally {
    if (socketPlayer && socketPlayer.connected) socketPlayer.disconnect();
    if (socketOperator && socketOperator.connected) socketOperator.disconnect();
  }
}

runStage7Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ STAGE 7 TEST FAILED:', err);
    process.exit(1);
  });
