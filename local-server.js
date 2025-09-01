// Local Network Server for ImageFlow Pro
// Runs an HTTP static file server and a WebSocket signaling server on the local network

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalImageFlowServer {
  constructor(port = 8080) {
    this.port = port;
    this.clients = new Map(); // clientId -> { id, ws, ip, userAgent, connectedAt, room }
    this.rooms = new Map();   // roomId -> { id, name, clients:Set<clientId>, createdAt, creator }

    this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocket.Server({ server: this.httpServer, path: '/ws' });
    this.wss.on('connection', this.onWsConnection.bind(this));

    this.localIP = this.getLocalIP();
  }

  getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      const list = ifaces[name] || [];
      for (const net of list) {
        if (net && net.family === 'IPv4' && !net.internal) {
          console.log(`Local IP Address: ${net.address}`);
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  }

  handleHttpRequest(req, res) {
    // Simple API endpoint for status
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

    // Serve static files
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    const safeBase = path.resolve(__dirname);
    const filePath = path.resolve(path.join(__dirname, urlPath));

    // Prevent directory traversal
    if (!filePath.startsWith(safeBase)) {
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

      const contentType = this.getContentType(path.extname(filePath));
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end(data);
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
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json'
    };
    return types[ext] || 'application/octet-stream';
  }

  onWsConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      room: null
    };

    this.clients.set(clientId, clientInfo);
    console.log(`Client connected: ${clientId} from ${clientInfo.ip}`);

    // Send welcome message with client ID
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
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
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${clientId}`);
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this.handleClientDisconnect(clientId);
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
      this.rooms.set(roomId, { id: roomId, clients: new Set(), createdAt: new Date() });
    }

    const room = this.rooms.get(roomId);
    room.clients.add(clientId);
    client.room = roomId;

    console.log(`Client ${clientId} joined room ${roomId}`);

    // Notify all clients in the room
    this.broadcastToRoom(roomId, {
      type: 'client-joined',
      clientId,
      roomClients: Array.from(room.clients)
    }, clientId);

    // Send room info to the joining client
    client.ws.send(JSON.stringify({
      type: 'room-joined',
      roomId,
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
        roomId,
        name: roomName,
        qrData: this.generateQRData(roomId)
      }));
    }

    console.log(`Client ${clientId} created room ${roomId}`);
  }

  handleWebRTCSignaling(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.room) return;

    // Forward WebRTC signaling to other clients in the room
    this.broadcastToRoom(client.room, { type: data.type, from: clientId, ...data }, clientId);
  }

  handleFileTransfer(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || !client.room) return;

    if (data.targetClient) {
      const target = this.clients.get(data.targetClient);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({ ...data, from: clientId }));
      }
    } else {
      this.broadcastToRoom(client.room, { ...data, from: clientId }, clientId);
    }
  }

  handleDeviceDiscovery(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const devices = Array.from(this.clients.entries())
      .filter(([id]) => id !== clientId)
      .map(([id, info]) => ({
        id,
        name: `Device ${id.substring(0, 8)}`,
        ip: info.ip,
        connectedAt: info.connectedAt,
        room: info.room
      }));

    client.ws.send(JSON.stringify({
      type: 'device-list',
      devices,
      serverInfo: { ip: this.localIP, port: this.port, clientCount: this.clients.size }
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
    if (!room) return;

    room.clients.delete(clientId);
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      this.broadcastToRoom(roomId, {
        type: 'client-left',
        clientId,
        roomClients: Array.from(room.clients)
      });
    }
  }

  broadcastToRoom(roomId, message, excludeClient = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const msg = JSON.stringify(message);
    room.clients.forEach(id => {
      if (id === excludeClient) return;
      const client = this.clients.get(id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
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
      roomId,
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

        console.log('ImageFlow Pro Local Server started!');
        console.log(`HTTP Server: http://${this.localIP}:${this.port}`);
        console.log(`WebSocket: ws://${this.localIP}:${this.port}/ws`);
        console.log('\nShare this URL with other devices on your network!');

        resolve({ ip: this.localIP, port: this.port, httpUrl: `http://${this.localIP}:${this.port}`, wsUrl: `ws://${this.localIP}:${this.port}/ws` });
      });
    });
  }

  stop() {
    if (this.wss) this.wss.close();
    if (this.httpServer) this.httpServer.close();
    console.log('Local server stopped');
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

// Run directly or export
if (require.main === module) {
  const server = new LocalImageFlowServer();
  server.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
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

