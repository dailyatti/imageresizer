// Local Network Server for ImageFlow Pro
// Runs a WebSocket signaling server on the local network

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalImageFlowServer {
  constructor(port = 8080) {
    this.port = port;
    this.clients = new Map();
    this.rooms = new Map();
    
    this.setupHTTPServer();
    this.setupWebSocketServer();
    this.getLocalIP();
  }

  getLocalIP() {
    const networkInterfaces = os.networkInterfaces();
    
    for (const interfaceName in networkInterfaces) {
      const networkInterface = networkInterfaces[interfaceName];
      for (const network of networkInterface) {
        // Skip internal and non-IPv4 addresses
        if (network.family === 'IPv4' && !network.internal) {
          this.localIP = network.address;
          console.log(`🌐 Local IP Address: ${this.localIP}`);
          return network.address;
        }
      }
    }
    
    this.localIP = '127.0.0.1';
    return '127.0.0.1';
  }

  setupHTTPServer() {
    this.httpServer = http.createServer((req, res) => {
      // Handle API endpoints
      if (req.url === '/api/status' || req.url === '/api/status/') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          status: 'running',
          ip: this.localIP,
          port: this.port,
          clients: this.clients.size,
          rooms: this.rooms.size,
          uptime: process.uptime(),
          timestamp: Date.now()
        }));
        return;
      }
      
      // Serve static files for the ImageFlow Pro application
      const url = req.url === '/' ? '/index.html' : req.url;
      const filePath = path.join(__dirname, url);
      
      // Security: prevent directory traversal
      if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(500);
            res.end('Server Error');
          }
          return;
        }
        
        // Set appropriate content type
        const ext = path.extname(filePath);
        const contentType = this.getContentType(ext);
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        res.end(data);
      });
    });
  }

  getContentType(ext) {
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return types[ext] || 'application/octet-stream';
  }

  setupWebSocketServer() {
    this.wss = new WebSocket.Server({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        ws: ws,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: new Date(),
        room: null
      };
      
      this.clients.set(clientId, clientInfo);
      console.log(`📱 Client connected: ${clientId} from ${clientInfo.ip}`);
      
      // Send welcome message with client ID
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        serverInfo: {
          ip: this.localIP,
          port: this.port,
          timestamp: Date.now()
        }
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Invalid message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`📱 Client disconnected: ${clientId}`);
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`Client ${clientId} error:`, error);
        this.handleClientDisconnect(clientId);
      });
    });
  }

  handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'join-room':
        this.handleJoinRoom(clientId, data.roomId);
        break;
        
      case 'create-room':
        this.handleCreateRoom(clientId, data.roomName);
        break;
        
      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'webrtc-ice-candidate':
        this.handleWebRTCSignaling(clientId, data);
        break;
        
      case 'file-transfer-start':
      case 'file-chunk':
      case 'file-complete':
        this.handleFileTransfer(clientId, data);
        break;
        
      case 'device-discovery':
        this.handleDeviceDiscovery(clientId);
        break;
        
      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  }

  handleJoinRoom(clientId, roomId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.room) {
      this.leaveRoom(clientId, client.room);
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        clients: new Set(),
        createdAt: new Date()
      });
    }

    const room = this.rooms.get(roomId);
    room.clients.add(clientId);
    client.room = roomId;

    console.log(`📱 Client ${clientId} joined room ${roomId}`);

    // Notify all clients in the room
    this.broadcastToRoom(roomId, {
      type: 'client-joined',
      clientId: clientId,
      roomClients: Array.from(room.clients)
    }, clientId);

    // Send room info to the joining client
    client.ws.send(JSON.stringify({
      type: 'room-joined',
      roomId: roomId,
      clients: Array.from(room.clients).filter(id => id !== clientId)
    }));
  }

  handleCreateRoom(clientId, roomName) {
    const roomId = this.generateRoomId();
    
    this.rooms.set(roomId, {
      id: roomId,
      name: roomName || `Room ${roomId}`,
      clients: new Set([clientId]),
      createdAt: new Date(),
      creator: clientId
    });

    const client = this.clients.get(clientId);
    if (client) {
      client.room = roomId;
      client.ws.send(JSON.stringify({
        type: 'room-created',
        roomId: roomId,
        name: roomName,
        qrData: this.generateQRData(roomId)
      }));
    }

    console.log(`📱 Client ${clientId} created room ${roomId}`);
  }

  handleWebRTCSignaling(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.room) return;

    // Forward WebRTC signaling to other clients in the room
    this.broadcastToRoom(client.room, {
      type: data.type,
      from: clientId,
      ...data
    }, clientId);
  }

  handleFileTransfer(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.room) return;

    // Forward file transfer messages to target client or all in room
    if (data.targetClient) {
      const targetClient = this.clients.get(data.targetClient);
      if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
          ...data,
          from: clientId
        }));
      }
    } else {
      this.broadcastToRoom(client.room, {
        ...data,
        from: clientId
      }, clientId);
    }
  }

  handleDeviceDiscovery(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const devices = Array.from(this.clients.entries())
      .filter(([id]) => id !== clientId)
      .map(([id, info]) => ({
        id: id,
        name: `Device ${id.substring(0, 8)}`,
        ip: info.ip,
        connectedAt: info.connectedAt,
        room: info.room
      }));

    client.ws.send(JSON.stringify({
      type: 'device-list',
      devices: devices,
      serverInfo: {
        ip: this.localIP,
        port: this.port,
        clientCount: this.clients.size
      }
    }));
  }

  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client && client.room) {
      this.leaveRoom(clientId, client.room);
    }
    this.clients.delete(clientId);
  }

  leaveRoom(clientId, roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clients.delete(clientId);
      
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted (empty)`);
      } else {
        this.broadcastToRoom(roomId, {
          type: 'client-left',
          clientId: clientId,
          roomClients: Array.from(room.clients)
        });
      }
    }
  }

  broadcastToRoom(roomId, message, excludeClient = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    room.clients.forEach(clientId => {
      if (clientId === excludeClient) return;
      
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  generateClientId() {
    return 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateRoomId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  generateQRData(roomId) {
    return {
      serverIP: this.localIP,
      port: this.port,
      roomId: roomId,
      url: `http://${this.localIP}:${this.port}/?room=${roomId}`,
      timestamp: Date.now()
    };
  }

  start() {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, '0.0.0.0', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`🚀 ImageFlow Pro Local Server started!`);
        console.log(`📡 HTTP Server: http://${this.localIP}:${this.port}`);
        console.log(`🔗 WebSocket: ws://${this.localIP}:${this.port}/ws`);
        console.log(`📱 QR Code URL: http://${this.localIP}:${this.port}`);
        console.log(`\n🌐 Share this URL with other devices on your network!`);
        
        resolve({
          ip: this.localIP,
          port: this.port,
          httpUrl: `http://${this.localIP}:${this.port}`,
          wsUrl: `ws://${this.localIP}:${this.port}/ws`
        });
      });
    });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    console.log('🛑 Local server stopped');
  }

  getStats() {
    return {
      clients: this.clients.size,
      rooms: this.rooms.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      ip: this.localIP,
      port: this.port
    };
  }
}

// Export for use as module or run directly
if (require.main === module) {
  const server = new LocalImageFlowServer();
  server.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });
} else {
  module.exports = LocalImageFlowServer;
}