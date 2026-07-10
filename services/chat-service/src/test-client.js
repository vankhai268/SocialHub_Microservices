import { io } from 'socket.io-client';
import axios from 'axios';

const GATEWAY_URL = 'http://localhost:8080/api';
const WS_GATEWAY_URL = 'http://localhost:8080';

async function runTest() {
  try {
    console.log('🚀 Starting SocialHub Chat Service Integration Test...');

    const timestamp = Date.now();
    const user1Email = `alice_${timestamp}@example.com`;
    const user2Email = `bob_${timestamp}@example.com`;
    const password = 'Password123!';

    // 1. Register test users
    console.log(`\n[REST] Step 1: Registering User 1 (Alice) & User 2 (Bob)...`);
    const reg1 = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email: user1Email,
      password,
      displayName: 'Alice Cooper'
    });
    const reg2 = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email: user2Email,
      password,
      displayName: 'Bob Marley'
    });

    const user1Id = reg1.data.user.id;
    const user2Id = reg2.data.user.id;
    console.log(`✅ Alice Registered (ID: ${user1Id})`);
    console.log(`✅ Bob Registered (ID: ${user2Id})`);

    // 2. Login to get tokens
    console.log('\n[REST] Step 2: Logging in via Gateway auth to get JWT tokens...');
    const login1 = await axios.post(`${GATEWAY_URL}/auth/login`, { email: user1Email, password });
    const login2 = await axios.post(`${GATEWAY_URL}/auth/login`, { email: user2Email, password });

    const token1 = login1.data.accessToken;
    const token2 = login2.data.accessToken;
    console.log('✅ Access tokens retrieved successfully');

    // 3. Create a 1-1 conversation between Alice and Bob
    console.log('\n[REST] Step 3: Alice creating 1-1 Conversation with Bob...');
    const convResponse = await axios.post(`${GATEWAY_URL}/conversations`, 
      { participantId: user2Id },
      { headers: { Authorization: `Bearer ${token1}` } }
    );

    const conversation = convResponse.data.data;
    const conversationId = conversation.id;
    console.log(`✅ Conversation created. ID: ${conversationId}`);

    // 4. Connect WebSockets through API Gateway
    console.log('\n[WS] Step 4: Connecting both Alice & Bob sockets to Gateway WebSocket proxy...');
    
    const socket1 = io(WS_GATEWAY_URL, {
      auth: { token: `Bearer ${token1}` },
      transports: ['websocket']
    });

    const socket2 = io(WS_GATEWAY_URL, {
      auth: { token: `Bearer ${token2}` },
      transports: ['websocket']
    });

    // Bob listeners
    socket2.on('connect', () => {
      console.log('🔌 Bob Socket connected to Gateway');
    });

    socket2.on('user:online', (data) => {
      console.log(`ℹ️ [Bob Client] Notified that User online: ${data.userId}`);
    });

    socket2.on('typing:indicator', (data) => {
      console.log(`ℹ️ [Bob Client] Typing status from ${data.displayName}: isTyping = ${data.isTyping}`);
    });

    socket2.on('message:received', (msg) => {
      console.log(`📬 [Bob Client] Received message: "${msg.content}" from ${msg.senderName}`);
      
      // Send a read acknowledgement back
      console.log(`\n[WS] Step 6: Bob sending read confirmation (message:read)...`);
      socket2.emit('message:read', { conversationId, messageId: msg.id });
    });

    // Alice listeners
    socket1.on('connect', () => {
      console.log('🔌 Alice Socket connected to Gateway');

      // 5. Trigger typing and sending message
      setTimeout(() => {
        console.log('\n[WS] Step 5: Alice starting to type (typing:start)...');
        socket1.emit('typing:start', { conversationId });
      }, 1000);

      setTimeout(() => {
        console.log('[WS] Alice stopped typing (typing:stop)...');
        socket1.emit('typing:stop', { conversationId });
      }, 3500);

      setTimeout(() => {
        console.log('[WS] Alice sending message: "Hello Bob!" (message:send)...');
        socket1.emit('message:send', {
          conversationId,
          content: 'Hello Bob!',
          type: 'text'
        });
      }, 5000);
    });

    socket1.on('message:read:ack', (data) => {
      console.log(`📬 [Alice Client] Received read confirmation acknowledgement (message:read:ack)`);
      console.log(`   Message ID ${data.messageId} was read by user ${data.readBy}`);
      console.log('\n🎉 ALL END-TO-END CHAT TESTS COMPLETED SUCCESSFULLY!');
      
      socket1.disconnect();
      socket2.disconnect();
      process.exit(0);
    });

    socket1.on('error', (err) => console.error('❌ Alice Socket Error:', err));
    socket2.on('error', (err) => console.error('❌ Bob Socket Error:', err));

  } catch (error) {
    console.error('❌ Test execution failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

runTest();
