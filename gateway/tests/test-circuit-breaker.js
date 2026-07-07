import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/index.js';

async function runCircuitBreakerTest() {
  console.log('🏁 Starting Circuit Breaker Integration Test...');

  // 1. Generate a dummy valid JWT token
  const secret = config.JWT_SECRET;
  const token = jwt.sign({ id: 'dummy-user-id', jti: 'dummy-jti' }, secret, { expiresIn: '1h' });
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Call media-service endpoint (which is stopped)
  try {
    console.log('📡 Calling /api/media/some-media-id through Gateway...');
    const res = await axios.get('http://localhost:8080/api/media/6a4cf05dcc6fd675fc2e9f2d', {
      headers: authHeaders
    });
    console.error('❌ Expected request to fail with 503, but it succeeded!', res.status);
    process.exit(1);
  } catch (err) {
    if (err.response) {
      console.log(`✅ Received Response Status: ${err.response.status}`);
      console.log('✅ Received Response Body:', err.response.data);
      
      if (err.response.status === 503 && err.response.data.error === 'Service Temporarily Unavailable') {
        console.log('🎉 CIRCUIT BREAKER FALLBACK TEST PASSED SUCCESSFULLY!');
        process.exit(0);
      } else {
        console.error('❌ Unexpected status or error format:', err.response.status, err.response.data);
        process.exit(1);
      }
    } else {
      console.error('❌ Network error or request timeout (Circuit Breaker did not handle it):', err.message);
      process.exit(1);
    }
  }
}

runCircuitBreakerTest();
