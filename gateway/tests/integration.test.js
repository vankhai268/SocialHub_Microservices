import axios from 'axios';

const GATEWAY_URL = 'http://localhost:8080/api';

async function runTests() {
  console.log('🏁 Starting Gateway Integration Tests...');
  let token = '';
  let userId = '';
  let mediaId = '';

  // 1. Health check
  try {
    const res = await axios.get('http://localhost:8080/health');
    console.log('✅ Gateway Health Check Passed:', res.data);
  } catch (err) {
    console.error('❌ Gateway Health Check Failed:', err.message);
    process.exit(1);
  }

  // 2. Register user
  const email = `test-${Date.now()}@example.com`;
  try {
    const res = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email,
      password: 'SecurePassword123!',
      name: 'Gateway Test User' // user-service expects 'name'
    });
    console.log('✅ User Registration Passed:', res.data.user.email);
    token = res.data.token.accessToken; // user-service returns 'token' (singular) for register
    userId = res.data.user.id;
  } catch (err) {
    console.error('❌ User Registration Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 3. Login user
  try {
    const res = await axios.post(`${GATEWAY_URL}/auth/login`, {
      email,
      password: 'SecurePassword123!'
    });
    console.log('✅ User Login Passed. Token acquired.');
    token = res.data.tokens.accessToken; // user-service returns 'tokens' (plural) for login
  } catch (err) {
    console.error('❌ User Login Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 4. Get User Profile
  try {
    const res = await axios.get(`${GATEWAY_URL}/users/${userId}`, { headers: authHeaders });
    console.log('✅ Get User Profile Passed:', res.data.user.displayName);
  } catch (err) {
    console.error('❌ Get User Profile Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 5. Update User Profile
  try {
    const res = await axios.put(`${GATEWAY_URL}/users/${userId}`, {
      name: 'Updated Test User', // user-service updateProfile parses 'name' (COALESCE($1, display_name))
      bio: 'Hello from gateway test script!'
    }, { headers: authHeaders });
    console.log('✅ Update User Profile Passed:', res.data.user.displayName, '-', res.data.user.bio);
  } catch (err) {
    console.error('❌ Update User Profile Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 6. Search Users
  try {
    const res = await axios.get(`${GATEWAY_URL}/users/search`, {
      params: { q: 'Updated' },
      headers: authHeaders
    });
    console.log('✅ Search Users Passed. Found:', res.data.data.length, 'users');
  } catch (err) {
    console.error('❌ Search Users Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 7. Upload Media
  try {
    const fileBlob = new Blob(['fake image content'], { type: 'image/png' });
    const form = new FormData();
    form.append('file', fileBlob, 'temp-test-image.png');

    const res = await axios.post(`${GATEWAY_URL}/media/upload`, form, {
      headers: authHeaders
    });

    mediaId = res.data.id;
    console.log('✅ Media Upload Passed. Media ID:', mediaId);
  } catch (err) {
    console.error('❌ Media Upload Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 8. Get Media Metadata
  try {
    const res = await axios.get(`${GATEWAY_URL}/media/${mediaId}`, { headers: authHeaders });
    console.log('✅ Get Media Metadata Passed. Original Name:', res.data.originalName);
  } catch (err) {
    console.error('❌ Get Media Metadata Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 9. Get Presigned URL
  try {
    const res = await axios.get(`${GATEWAY_URL}/media/${mediaId}/url`, { headers: authHeaders });
    console.log('✅ Get Presigned URL Passed. URL:', res.data.url.substring(0, 80) + '...');
  } catch (err) {
    console.error('❌ Get Presigned URL Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 10. Logout and test blacklist
  try {
    await axios.post(`${GATEWAY_URL}/auth/logout`, {}, { headers: authHeaders });
    console.log('✅ Logout User Passed.');
    
    // Check if token is blacklisted
    try {
      await axios.get(`${GATEWAY_URL}/users/${userId}`, { headers: authHeaders });
      console.error('❌ Blacklist Check Failed: Token was still accepted after logout!');
      process.exit(1);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('✅ Token Blacklisting Passed (Request blocked with 401).');
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('❌ Logout / Blacklist Test Failed:', err.message);
    process.exit(1);
  }

  console.log('\n🎉 ALL GATEWAY ROUTING TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests();
