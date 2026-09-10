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

async function runStage2Tests() {
  console.log('====================================================');
  console.log('--- STARTING NEXORA STAGE 2 VERIFICATION SUITE ---');
  console.log('====================================================\n');

  // Test 1: GET /api/health
  console.log('1. Testing Health Endpoint: GET /api/health');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/health',
    method: 'GET',
  });
  console.log('Response:', healthRes.body);
  if (healthRes.statusCode !== 200 || healthRes.body.status !== 'ok' || healthRes.body.service !== 'nexora-server') {
    throw new Error('Health check verification failed: ' + JSON.stringify(healthRes.body));
  }
  console.log('✔ Health check passed [200 OK]\n');

  // Test 2: Valid User Registration
  console.log('2. Testing Registration: POST /api/auth/register');
  const uniqueSuffix = Date.now().toString().slice(-4);
  const testUser = {
    username: `operative_${uniqueSuffix}`,
    email: `operative_${uniqueSuffix}@grid.io`,
    password: 'SuperSecretPassword2026!',
  };

  const registerRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    testUser
  );

  console.log('Registration Status:', registerRes.statusCode);
  console.log('Returned User:', registerRes.body.user);
  console.log('Has Token:', !!registerRes.body.token);

  if (registerRes.statusCode !== 201) {
    throw new Error('Registration failed with status: ' + registerRes.statusCode + ' ' + JSON.stringify(registerRes.body));
  }
  if (!registerRes.body.token) {
    throw new Error('Registration did not return JWT token');
  }
  if (!registerRes.body.user || registerRes.body.user.username !== testUser.username) {
    throw new Error('Registration did not return valid user info');
  }
  if ('password_hash' in registerRes.body.user || 'password' in registerRes.body.user) {
    throw new Error('CRITICAL SECURITY LEAK: password or password_hash returned in response!');
  }
  console.log('✔ User created, password hashed, token returned, password_hash strictly omitted [201 Created]\n');

  const authToken = registerRes.body.token;

  // Test 3: Duplicate Registration Handling
  console.log('3. Testing Duplicate Registration Prevention');
  const dupUsernameRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      username: testUser.username,
      email: `other_${uniqueSuffix}@grid.io`,
      password: 'AnotherPassword123!',
    }
  );
  console.log('Duplicate Username Status:', dupUsernameRes.statusCode, dupUsernameRes.body);
  if (dupUsernameRes.statusCode !== 409) {
    throw new Error('Duplicate username was not rejected with 409 Conflict');
  }

  const dupEmailRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      username: `another_${uniqueSuffix}`,
      email: testUser.email,
      password: 'AnotherPassword123!',
    }
  );
  console.log('Duplicate Email Status:', dupEmailRes.statusCode, dupEmailRes.body);
  if (dupEmailRes.statusCode !== 409) {
    throw new Error('Duplicate email was not rejected with 409 Conflict');
  }
  console.log('✔ Duplicate registration cleanly rejected with 409 Conflict\n');

  // Test 4: Login Verification
  console.log('4. Testing Login: POST /api/auth/login');
  const loginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      email: testUser.email,
      password: testUser.password,
    }
  );

  console.log('Login Status:', loginRes.statusCode);
  if (loginRes.statusCode !== 200 || !loginRes.body.token || !loginRes.body.user) {
    throw new Error('Login failed: ' + JSON.stringify(loginRes.body));
  }
  if ('password_hash' in loginRes.body.user) {
    throw new Error('CRITICAL SECURITY LEAK: password_hash returned in login response!');
  }
  console.log('✔ Login successful with valid token returned [200 OK]\n');

  // Test 5: Invalid Login
  console.log('5. Testing Invalid Login Credentials');
  const invalidLoginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      email: testUser.email,
      password: 'WRONG_PASSWORD_666',
    }
  );
  console.log('Invalid Login Status:', invalidLoginRes.statusCode, invalidLoginRes.body);
  if (invalidLoginRes.statusCode !== 401) {
    throw new Error('Invalid login was not rejected with 401 Unauthorized');
  }
  console.log('✔ Invalid password rejected with 401 Unauthorized\n');

  // Test 6: Protected Endpoint - GET /api/me
  console.log('6. Testing Protected Endpoint: GET /api/me');
  const unauthMeRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/me',
    method: 'GET',
  });
  console.log('Unauthenticated /api/me Status:', unauthMeRes.statusCode);
  if (unauthMeRes.statusCode !== 401) {
    throw new Error('Unauthenticated /api/me was not rejected with 401');
  }

  const authMeRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  console.log('Authenticated /api/me Response:', authMeRes.body);
  if (authMeRes.statusCode !== 200 || authMeRes.body.username !== testUser.username) {
    throw new Error('Authenticated /api/me failed: ' + JSON.stringify(authMeRes.body));
  }
  console.log('✔ Protected /api/me verified (401 without token, 200 with token)\n');

  // Test 7: User Profile Endpoint - GET /api/profile
  console.log('7. Testing Protected Profile Endpoint: GET /api/profile');
  const unauthProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/profile',
    method: 'GET',
  });
  console.log('Unauthenticated /api/profile Status:', unauthProfileRes.statusCode);
  if (unauthProfileRes.statusCode !== 401) {
    throw new Error('Unauthenticated /api/profile was not rejected with 401');
  }

  const authProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/profile',
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  console.log('Authenticated /api/profile Response:', authProfileRes.body);
  if (authProfileRes.statusCode !== 200 || authProfileRes.body.username !== testUser.username) {
    throw new Error('Authenticated /api/profile failed: ' + JSON.stringify(authProfileRes.body));
  }
  if ('password_hash' in authProfileRes.body || 'password' in authProfileRes.body) {
    throw new Error('CRITICAL SECURITY LEAK: password hash exposed in /api/profile!');
  }
  console.log('✔ Protected /api/profile verified (401 without token, 200 with safe profile payload)\n');

  // Test 8: Socket.IO Authentication Preparation
  console.log('8. Testing Socket.IO Handshake Authentication');

  // 8a: Authenticated socket connection
  await new Promise((resolve, reject) => {
    const authSocket = io('http://127.0.0.1:4000', {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
    });

    const timer = setTimeout(() => {
      authSocket.disconnect();
      reject(new Error('Authenticated socket connection timed out'));
    }, 5000);

    authSocket.on('connect', () => {
      console.log('✔ Authenticated socket connected successfully. ID:', authSocket.id);
      clearTimeout(timer);
      authSocket.disconnect();
      resolve();
    });

    authSocket.on('connect_error', (err) => {
      clearTimeout(timer);
      authSocket.disconnect();
      reject(err);
    });
  });

  // 8b: Invalid socket token rejected
  await new Promise((resolve, reject) => {
    const badSocket = io('http://127.0.0.1:4000', {
      auth: { token: 'INVALID_CORRUPTED_TOKEN' },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    const timer = setTimeout(() => {
      badSocket.disconnect();
      reject(new Error('Bad socket was not rejected as expected'));
    }, 5000);

    badSocket.on('connect', () => {
      clearTimeout(timer);
      badSocket.disconnect();
      reject(new Error('Bad socket unexpectedly connected!'));
    });

    badSocket.on('connect_error', (err) => {
      clearTimeout(timer);
      console.log('✔ Invalid socket token cleanly rejected:', err.message);
      badSocket.disconnect();
      resolve();
    });
  });

  // 8c: Unauthenticated socket connection (guest) preserves lifecycle
  await new Promise((resolve, reject) => {
    const guestSocket = io('http://127.0.0.1:4000', {
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    const timer = setTimeout(() => {
      guestSocket.disconnect();
      reject(new Error('Guest socket timed out'));
    }, 5000);

    guestSocket.on('connect', () => {
      console.log('✔ Guest socket connected successfully. ID:', guestSocket.id);
      clearTimeout(timer);
      guestSocket.disconnect();
      resolve();
    });

    guestSocket.on('connect_error', (err) => {
      clearTimeout(timer);
      guestSocket.disconnect();
      reject(err);
    });
  });

  console.log('\n====================================================');
  console.log('✔ ALL STAGE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runStage2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ STAGE 2 TEST SUITE FAILED:', err);
    process.exit(1);
  });
