const assert = require('assert');
const http = require('http');
const app = require('../index');

console.log('🧪 Testing API authentication endpoints...');

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(`${baseUrl}${path}`, { method, headers: reqHeaders }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health...');
    const health = await makeRequest('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'ok');
    console.log('   ✅ GET /api/health returned 200 OK');

    // 2. Valid login
    console.log('2. Testing POST /api/auth/login (valid credentials)...');
    const validLogin = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(validLogin.status, 200, `Expected 200, got ${validLogin.status}`);
    assert(validLogin.data.token, 'Response should contain JWT token');
    assert.strictEqual(validLogin.data.user.username, 'admin');
    console.log('   ✅ Valid login returned 200 with JWT token and user profile');

    // 3. Invalid credentials
    console.log('3. Testing POST /api/auth/login (invalid credentials)...');
    const invalidLogin = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'wrongpassword' });
    assert.strictEqual(invalidLogin.status, 401, `Expected 401, got ${invalidLogin.status}`);
    assert.strictEqual(invalidLogin.data.error, 'Invalid username or password');
    console.log('   ✅ Invalid login returned 401 Unauthorized');

    // 4. Missing credentials
    console.log('4. Testing POST /api/auth/login (missing fields)...');
    const missingLogin = await makeRequest('POST', '/api/auth/login', { username: '' });
    assert.strictEqual(missingLogin.status, 400, `Expected 400, got ${missingLogin.status}`);
    console.log('   ✅ Missing credentials returned 400 Bad Request');

    // 5. GET on login endpoint (unsupported method)
    console.log('5. Testing GET /api/auth/login (unsupported method)...');
    const getLogin = await makeRequest('GET', '/api/auth/login');
    assert.strictEqual(getLogin.status, 404, `Expected 404, got ${getLogin.status}`);
    console.log('   ✅ GET /api/auth/login returned 404 (route not matched for GET)');

    // 6. Test /api/auth/me with token from step 2
    console.log('6. Testing GET /api/auth/me with token...');
    const meRes = await makeRequest('GET', '/api/auth/me', null, { Authorization: `Bearer ${validLogin.data.token}` });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.username, 'admin');
    assert(meRes.data.permissions, 'Permissions should be populated');
    console.log('   ✅ GET /api/auth/me returned 200 with user data');

    console.log('\n🎉 ALL AUTHENTICATION API TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
