const WebSocket = require('ws');

// Configuration
const ROOM_ID = 'TEST123';
const SERVER_URL = 'ws://localhost:5000/ws/game/' + ROOM_ID;
const NUM_CLIENTS = 2;
const PING_INTERVAL = 5000; // ms
const TEST_DURATION = 60000; // 60 seconds

console.log('WebSocket Server Test');
console.log('====================');
console.log(`Server URL: ${SERVER_URL}`);
console.log(`Number of clients: ${NUM_CLIENTS}`);
console.log(`Test duration: ${TEST_DURATION / 1000} seconds`);
console.log(`Ping interval: ${PING_INTERVAL / 1000} seconds`);
console.log('====================\n');

// Create clients
const clients = [];
for (let i = 0; i < NUM_CLIENTS; i++) {
    const clientId = `Client-${i + 1}`;
    console.log(`Creating ${clientId}...`);
    
    const ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
        console.log(`${clientId}: Connected`);
        
        // Send a ping message
        const pingMessage = {
            type: 'ping',
            roomId: ROOM_ID,
            clientId: clientId,
            timestamp: Date.now()
        };
        ws.send(JSON.stringify(pingMessage));
        console.log(`${clientId}: Sent ping`);
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log(`${clientId}: Received: ${JSON.stringify(message)}`);
            
            // If we received a color assignment, log it
            if (message.type === 'color_assigned' || message.type === 'color_confirmed') {
                console.log(`${clientId}: Assigned color: ${message.color}`);
            }
            
            // If we received game_start, log it
            if (message.type === 'game_start') {
                console.log(`${clientId}: Game started`);
            }
        } catch (error) {
            console.error(`${clientId}: Error parsing message:`, error);
        }
    });
    
    ws.on('error', (error) => {
        console.error(`${clientId}: WebSocket error:`, error);
    });
    
    ws.on('close', (code, reason) => {
        console.log(`${clientId}: Connection closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    });
    
    // Setup ping interval
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const pingMessage = {
                type: 'ping',
                roomId: ROOM_ID,
                clientId: clientId,
                timestamp: Date.now()
            };
            ws.send(JSON.stringify(pingMessage));
            console.log(`${clientId}: Sent ping`);
        }
    }, PING_INTERVAL);
    
    clients.push({
        id: clientId,
        ws,
        pingInterval
    });
}

// End test after duration
setTimeout(() => {
    console.log('\n====================');
    console.log('Test completed. Closing connections...');
    
    clients.forEach(client => {
        clearInterval(client.pingInterval);
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Test completed');
            console.log(`${client.id}: Connection closed`);
        }
    });
    
    console.log('All connections closed. Exiting...');
    process.exit(0);
}, TEST_DURATION);

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nTest interrupted. Closing connections...');
    
    clients.forEach(client => {
        clearInterval(client.pingInterval);
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Test interrupted');
            console.log(`${client.id}: Connection closed`);
        }
    });
    
    console.log('All connections closed. Exiting...');
    process.exit(0);
}); 