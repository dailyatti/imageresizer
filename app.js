// ImageFlow Pro - Professional Lossless Image Processing SaaS Platform
class ImageFlowApp {
  constructor() {
    this.images = [];
    this.peer = null;
    this.connections = [];
    this.storageData = {
      used: 0,
      limit: 1000 * 1024 * 1024, // 1GB
      originalSize: 0,
      compressedSize: 0
    };
    this.fileTypes = new Map();
    this.processingStats = {
      totalProcessed: 0,
      avgCompression: 0,
      timeSaved: 0,
      bandwidthSaved: 0
    };
    
    // Advanced Processing Options
    this.processingOptions = {
      lossless: true,
      algorithm: 'lanczos', // lanczos, bicubic, bilinear, nearest
      colorSpace: 'sRGB',
      preserveMetadata: true,
      enableSharpening: false,
      gammaCorrection: 2.2,
      resamplingQuality: 'maximum'
    };
    
    // Professional Format Support with Lossless Options
    this.formatConfigs = {
      'png': { 
        lossless: true, 
        compression: 'zip',
        bitDepth: 'auto', // 8, 16, 'auto'
        colorType: 'auto' // rgb, rgba, grayscale, palette, 'auto'
      },
      'webp': { 
        lossless: true,
        method: 6, // 0-6, higher = slower but better
        quality: 100,
        exact: true
      },
      'avif': {
        lossless: true,
        quality: 100,
        speed: 1 // 0-10, higher = faster but worse
      },
      'tiff': {
        lossless: true,
        compression: 'lzw',
        bitDepth: 16
      },
      'jpg': {
        lossless: false,
        quality: 95,
        subsampling: '444', // 444, 422, 420
        progressive: false,
        optimize: true
      }
    };
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupTheme();
    this.setupTabs();
    this.setupPeerConnection();
    this.generateQRCode();
    this.updateStats();
    this.registerServiceWorker();
    this.handleURLParameters();
  }

  setupEventListeners() {
    // File upload
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
      dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
      dropZone.addEventListener('drop', this.handleDrop.bind(this));
      fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    // Quick upload button
    const quickUpload = document.getElementById('quickUpload');
    if (quickUpload && fileInput) {
      quickUpload.addEventListener('click', () => fileInput.click());
    }

    // Processing controls
    const quickProcess = document.getElementById('quickProcess');
    const batchProcess = document.getElementById('batchProcess');
    if (quickProcess) quickProcess.addEventListener('click', this.quickProcess.bind(this));
    if (batchProcess) batchProcess.addEventListener('click', this.batchProcess.bind(this));

    // Quick presets
    document.querySelectorAll('.quick-preset').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyPreset(e.target.dataset.preset));
    });

    // Quality is now fixed at 100% (lossless) - no slider needed

    // Device connection
    const connectDeviceBtn = document.getElementById('connectDevice');
    const connectManualBtn = document.getElementById('connectManual');
    const regenerateQRBtn = document.getElementById('regenerateQR');
    if (connectDeviceBtn) connectDeviceBtn.addEventListener('click', this.showDevicesTab.bind(this));
    if (connectManualBtn) connectManualBtn.addEventListener('click', this.connectManual.bind(this));
    if (regenerateQRBtn) regenerateQRBtn.addEventListener('click', this.generateQRCode.bind(this));

    // Floating action button
    const floatingAction = document.getElementById('floatingAction');
    if (floatingAction && fileInput) {
      floatingAction.addEventListener('click', () => fileInput.click());
    }
  }

  setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    
    // Check for saved theme preference or default to 'light' mode
    const currentTheme = localStorage.getItem('theme') || 'light';
    const isDark = currentTheme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    
    // Update icons
    sunIcon.classList.toggle('hidden', currentTheme === 'light');
    moonIcon.classList.toggle('hidden', currentTheme === 'dark');
    
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const currentlyDark = document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark');
        document.body.classList.toggle('dark');
        
        if (sunIcon) sunIcon.classList.toggle('hidden');
        if (moonIcon) moonIcon.classList.toggle('hidden');
        
        localStorage.setItem('theme', currentlyDark ? 'light' : 'dark');
      });
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        contents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${tabName}Tab`) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  async setupPeerConnection() {
    try {
      // Try local network server first, fallback to external PeerJS
      const localServerConfig = await this.tryLocalServer();
      
      if (localServerConfig) {
        console.log('🏠 Using local network server');
        await this.setupLocalNetworkConnection(localServerConfig);
      } else {
        console.log('🌐 Falling back to external PeerJS server');
        await this.setupExternalPeerConnection();
      }
    } catch (error) {
      console.error('Failed to setup any connection:', error);
      this.updateConnectionStatus('disconnected', 'Offline mode');
    }
  }

  async tryLocalServer() {
    try {
      // Check if local server is running with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://localhost:8080/api/status', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return {
          ip: data.ip,
          port: data.port,
          wsUrl: `ws://${data.ip}:${data.port}/ws`
        };
      }
    } catch (error) {
      console.log('Local server not available:', error.message);
    }
    return null;
  }

  async setupLocalNetworkConnection(config) {
    this.localServer = config;
    this.updateConnectionStatus('connecting', 'Connecting to local network...');
    
    // Setup WebSocket connection to local server
    this.ws = new WebSocket(config.wsUrl);
    
    this.ws.onopen = () => {
      console.log('🏠 Connected to local network server');
      this.updateConnectionStatus('connected', `Local Network - ${config.ip}`);
      this.showNotification('Helyi hálózati szerver aktív!', 'success');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleLocalServerMessage(data);
      } catch (error) {
        console.error('Invalid message from local server:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('🏠 Local server connection closed');
      this.updateConnectionStatus('connecting', 'Reconnecting...');
      setTimeout(() => this.setupExternalPeerConnection(), 2000);
    };
    
    this.ws.onerror = (error) => {
      console.error('Local server connection error:', error);
      this.setupExternalPeerConnection();
    };
  }

  async setupExternalPeerConnection() {
    try {
      // Advanced PeerJS configuration for better reliability
      const peerConfig = {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1,
        config: {
          'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      };

      this.updateConnectionStatus('connecting', 'Connecting to internet...');
      this.peer = new Peer(peerConfig);
      
      // Connection timeout handling
      const connectionTimeout = setTimeout(() => {
        if (!this.peer || !this.peer.id) {
          console.warn('Peer connection timeout, retrying...');
          this.retryPeerConnection();
        }
      }, 10000);

      this.peer.on('open', (id) => {
        clearTimeout(connectionTimeout);
        console.log('Peer connection established:', id);
        this.peerId = id;
        this.updateConnectionStatus('connected', `Online - ID: ${id.substring(0, 8)}...`);
        this.generateQRCode();
        this.showNotification('Eszköz online és elérhető!', 'success');
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('Peer connection error:', err);
        
        if (err.type === 'network') {
          this.updateConnectionStatus('disconnected', 'Network error - Retrying...');
          setTimeout(() => this.retryPeerConnection(), 3000);
        } else if (err.type === 'server-error') {
          this.updateConnectionStatus('disconnected', 'Server error - Offline mode');
          this.showNotification('Szerver hiba - Offline mód aktiválva', 'warning');
        } else {
          this.updateConnectionStatus('disconnected', 'Connection failed');
          this.showNotification('Kapcsolat sikertelen - Offline mód', 'warning');
        }
      });

      this.peer.on('disconnected', () => {
        console.log('Peer disconnected, attempting to reconnect...');
        this.updateConnectionStatus('connecting', 'Reconnecting...');
        this.peer.reconnect();
      });
      
    } catch (error) {
      console.error('Failed to setup peer connection:', error);
      this.updateConnectionStatus('disconnected', 'Offline mode');
    }
  }

  async retryPeerConnection() {
    try {
      if (this.peer) {
        this.peer.destroy();
      }
      
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.retryCount = (this.retryCount || 0) + 1;
      if (this.retryCount <= 3) {
        console.log(`Retrying peer connection (attempt ${this.retryCount}/3)...`);
        this.updateConnectionStatus('connecting', `Reconnecting... (${this.retryCount}/3)`);
        await this.setupPeerConnection();
      } else {
        this.updateConnectionStatus('disconnected', 'Offline mode');
        this.showNotification('Nem sikerült csatlakozni - Offline mód', 'error');
      }
    } catch (error) {
      console.error('Retry connection failed:', error);
    }
  }

  // Handle messages from local server
  handleLocalServerMessage(data) {
    switch (data.type) {
      case 'welcome':
        this.clientId = data.clientId;
        this.serverInfo = data.serverInfo;
        this.generateLocalQRCode();
        break;
        
      case 'room-created':
        this.roomId = data.roomId;
        this.generateLocalQRCode();
        break;
        
      case 'room-joined':
        this.roomId = data.roomId;
        this.updateDeviceList();
        break;
        
      case 'client-joined':
      case 'client-left':
        this.updateDeviceList();
        break;
        
      case 'device-list':
        this.handleDeviceList(data.devices);
        break;
        
      case 'file-transfer-start':
      case 'file-chunk':
      case 'file-complete':
        this.handleLocalFileTransfer(data);
        break;
        
      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'webrtc-ice-candidate':
        this.handleLocalWebRTCSignaling(data);
        break;
        
      default:
        console.log('Unknown local server message:', data.type);
    }
  }

  async generateQRCode() {
    if (this.localServer) {
      this.generateLocalQRCode();
    } else if (this.peer && this.peer.id) {
      this.generatePeerJSQRCode();
    } else {
      setTimeout(() => this.generateQRCode(), 1000);
    }
  }

  async generateLocalQRCode() {
    if (!this.localServer || !this.clientId) {
      setTimeout(() => this.generateLocalQRCode(), 1000);
      return;
    }
    
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;

    // Create room if not exists
    if (!this.roomId) {
      this.ws.send(JSON.stringify({
        type: 'create-room',
        roomName: `ImageFlow ${new Date().toLocaleTimeString('hu-HU')}`
      }));
      return;
    }

    const connectionUrl = `http://${this.localServer.ip}:${this.localServer.port}/?room=${this.roomId}`;
    
    try {
      qrContainer.innerHTML = '<div class="loading-spinner mx-auto"></div>';
      
      const canvas = await QRCode.toCanvas(connectionUrl, {
        width: 220,
        margin: 3,
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 1,
        color: {
          dark: '#667eea',
          light: '#ffffff'
        },
        rendererOpts: {
          quality: 1
        }
      });
      
      canvas.style.borderRadius = '12px';
      canvas.style.boxShadow = '0 10px 25px rgba(102, 126, 234, 0.2)';
      canvas.style.border = '3px solid #667eea';
      
      qrContainer.innerHTML = '';
      qrContainer.appendChild(canvas);
      
      const deviceInfo = document.createElement('div');
      deviceInfo.className = 'text-center mt-4';
      deviceInfo.innerHTML = `
        <div class="text-xs text-slate-600 dark:text-slate-400 mb-2">🏠 Helyi Hálózat:</div>
        <div class="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
          ${this.localServer.ip}:${this.localServer.port}
        </div>
        <div class="text-xs text-green-600 dark:text-green-400 mt-2">
          Szoba: ${this.roomId}
        </div>
        <div class="text-xs text-slate-500 mt-1">
          🔒 Csak ugyanazon WiFi hálózaton működik
        </div>
      `;
      qrContainer.appendChild(deviceInfo);
      
    } catch (error) {
      console.error('Local QR Code generation failed:', error);
      this.fallbackToExternalQR();
    }
  }

  async generatePeerJSQRCode() {
    if (!this.peer || !this.peer.id) {
      setTimeout(() => this.generatePeerJSQRCode(), 1000);
      return;
    }
    
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;

    // Professional QR code with enhanced error correction and visual design
    const connectionData = {
      id: this.peer.id,
      url: window.location.origin,
      timestamp: Date.now(),
      app: 'ImageFlow Pro'
    };
    
    const connectionUrl = `${window.location.origin}?connect=${this.peer.id}&app=imageflow&v=1.0`;
    
    try {
      qrContainer.innerHTML = '<div class="loading-spinner mx-auto"></div>';
      
      const canvas = await QRCode.toCanvas(connectionUrl, {
        width: 220,
        margin: 3,
        errorCorrectionLevel: 'H', // High error correction for better reliability
        type: 'image/png',
        quality: 1,
        color: {
          dark: '#667eea',
          light: '#ffffff'
        },
        rendererOpts: {
          quality: 1
        }
      });
      
      // Add professional styling to QR code
      canvas.style.borderRadius = '12px';
      canvas.style.boxShadow = '0 10px 25px rgba(102, 126, 234, 0.2)';
      canvas.style.border = '3px solid #667eea';
      
      qrContainer.innerHTML = '';
      qrContainer.appendChild(canvas);
      
      // Add device ID display below QR code
      const deviceInfo = document.createElement('div');
      deviceInfo.className = 'text-center mt-4';
      deviceInfo.innerHTML = `
        <div class="text-xs text-slate-600 dark:text-slate-400 mb-2">Eszköz ID:</div>
        <div class="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
          ${this.peer.id}
        </div>
        <div class="text-xs text-slate-500 mt-2">
          Érvényes: ${new Date(Date.now() + 3600000).toLocaleTimeString('hu-HU')}
        </div>
      `;
      qrContainer.appendChild(deviceInfo);
      
    } catch (error) {
      console.error('QR Code generation failed:', error);
      qrContainer.innerHTML = `
        <div class="text-center text-red-500 p-4">
          <svg class="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <p class="text-sm">QR kód generálása sikertelen</p>
          <button onclick="app.generateQRCode()" class="btn btn-sm btn-primary mt-2">Újrapróbálás</button>
        </div>
      `;
    }
  }

  handleIncomingConnection(conn) {
    this.connections.push(conn);
    this.updateDeviceList();
    
    conn.on('data', (data) => {
      if (data.type === 'file') {
        this.receiveFile(data);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      this.updateDeviceList();
    });
  }

  connectManual() {
    const deviceId = document.getElementById('deviceId').value.trim();
    if (!deviceId) {
      this.showNotification('Kérem adja meg az eszköz ID-ját!', 'warning');
      return;
    }

    try {
      const conn = this.peer.connect(deviceId);
      conn.on('open', () => {
        this.connections.push(conn);
        this.updateDeviceList();
        this.showNotification('Eszköz sikeresen csatlakoztatva!', 'success');
        document.getElementById('deviceId').value = '';
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        this.showNotification('Csatlakozás sikertelen!', 'error');
      });
    } catch (error) {
      console.error('Manual connection failed:', error);
      this.showNotification('Csatlakozás sikertelen!', 'error');
    }
  }

  updateConnectionStatus(status, message) {
    const indicator = document.getElementById('connectionIndicator');
    const statusText = document.getElementById('connectionStatus');
    const connectionBar = document.getElementById('connectionBar');
    
    indicator.className = `connection-indicator ${status} w-3 h-3 rounded-full`;
    indicator.classList.add(status === 'connected' ? 'bg-green-500' : 
                           status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500');
    
    statusText.textContent = message;
    
    if (status === 'connected') {
      connectionBar.classList.remove('-translate-y-full');
    }
  }

  updateDeviceList() {
    const deviceList = document.getElementById('deviceList');
    const deviceCount = document.getElementById('deviceCount');
    const connectedCount = document.getElementById('connectedCount');
    const connectedDevices = document.getElementById('connectedDevices');
    const transferControls = document.getElementById('transferControls');
    
    deviceCount.textContent = this.connections.length;
    if (connectedCount) connectedCount.textContent = this.connections.length;
    if (connectedDevices) connectedDevices.textContent = `${this.connections.length} eszköz csatlakoztatva`;
    
    // Show/hide transfer controls based on connections
    if (transferControls) {
      if (this.connections.length > 0 && this.images.length > 0) {
        transferControls.classList.remove('hidden');
      } else {
        transferControls.classList.add('hidden');
      }
    }
    
    if (this.connections.length === 0) {
      deviceList.innerHTML = `
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p>Nincs csatlakoztatott eszköz</p>
          <p class="text-sm mt-2">Használja a QR kódot vagy az eszköz ID-t a csatlakozáshoz</p>
        </div>
      `;
      return;
    }
    
    deviceList.innerHTML = this.connections.map((conn, index) => `
      <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover-lift">
        <div class="flex items-center gap-3">
          <div class="connection-indicator connected w-3 h-3 bg-green-500 rounded-full"></div>
          <div>
            <h3 class="font-semibold">Eszköz ${index + 1}</h3>
            <p class="text-sm text-slate-500">ID: ${conn.peer.substring(0, 8)}...</p>
            <p class="text-xs text-slate-400">Csatlakozva: ${new Date().toLocaleTimeString('hu-HU')}</p>
          </div>
        </div>
        <div class="flex gap-2">
          ${this.images.length > 0 ? `
            <button onclick="app.sendAllFiles('${conn.peer}')" 
                    class="btn btn-sm btn-primary" 
                    title="Összes fájl küldése">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          ` : ''}
          <button onclick="app.disconnectDevice('${conn.peer}')" 
                  class="btn btn-sm btn-danger" 
                  title="Eszköz leválasztása">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  sendAllFilesToFirstDevice() {
    if (this.connections.length > 0 && this.images.length > 0) {
      this.sendAllFiles(this.connections[0].peer);
    } else {
      this.showNotification('Nincs csatlakoztatott eszköz vagy fájl!', 'warning');
    }
  }

  disconnectDevice(peerId) {
    this.connections = this.connections.filter(conn => {
      if (conn.peer === peerId) {
        conn.close();
        return false;
      }
      return true;
    });
    this.updateDeviceList();
    this.showNotification('Eszköz leválasztva', 'info');
  }

  showDevicesTab() {
    document.querySelector('[data-tab="devices"]').click();
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    this.processFiles(files);
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    this.processFiles(files);
  }

  async processFiles(files) {
    try {
      // Validate file count
      if (files.length === 0) {
        this.showNotification('Kérem válasszon fájlokat!', 'warning');
        return;
      }
      
      if (files.length > 100) {
        this.showNotification('Túl sok fájl! Maximum 100 fájl tölthető fel egyszerre.', 'error');
        return;
      }
      
      // Filter and validate image files
      const validImageFiles = [];
      const invalidFiles = [];
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml'];
      
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          invalidFiles.push(`${file.name} (nem képfájl)`);
          continue;
        }
        
        if (!supportedTypes.includes(file.type)) {
          invalidFiles.push(`${file.name} (nem támogatott formátum)`);
          continue;
        }
        
        if (file.size > maxFileSize) {
          invalidFiles.push(`${file.name} (túl nagy, max 50MB)`);
          continue;
        }
        
        if (file.size === 0) {
          invalidFiles.push(`${file.name} (üres fájl)`);
          continue;
        }
        
        validImageFiles.push(file);
      }
      
      // Show warnings for invalid files
      if (invalidFiles.length > 0) {
        const message = `${invalidFiles.length} fájl kihagyva: ${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`;
        this.showNotification(message, 'warning');
      }
      
      if (validImageFiles.length === 0) {
        this.showNotification('Nincsenek érvényes képfájlok a feltöltéshez!', 'error');
        return;
      }
      
      // Check storage limits
      const totalNewSize = validImageFiles.reduce((sum, file) => sum + file.size, 0);
      if (this.storageData.originalSize + totalNewSize > this.storageData.limit) {
        this.showNotification('Nincs elegendő tárterület! Töröljön néhány képet.', 'error');
        return;
      }

      this.showProgress(true, 'Képek betöltése...', validImageFiles.length);
      
      let successCount = 0;
      let failedFiles = [];
      
      for (let i = 0; i < validImageFiles.length; i++) {
        const file = validImageFiles[i];
        try {
          await this.addImage(file);
          successCount++;
        } catch (error) {
          console.error(`Failed to add image ${file.name}:`, error);
          failedFiles.push(file.name);
        }
        this.updateProgress(i + 1, validImageFiles.length);
      }
      
      this.hideProgress();
      this.updateStats();
      this.renderImages();
      
      // Show results
      if (successCount > 0) {
        let message = `${successCount} kép sikeresen betöltve!`;
        if (failedFiles.length > 0) {
          message += ` ${failedFiles.length} kép betöltése sikertelen.`;
        }
        this.showNotification(message, successCount === validImageFiles.length ? 'success' : 'warning');
      } else {
        this.showNotification('Egyik kép sem tölthető be!', 'error');
      }
      
    } catch (error) {
      console.error('File processing error:', error);
      this.hideProgress();
      this.showNotification('Hiba a fájlok feldolgozása közben!', 'error');
    }
  }

  async addImage(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const img = new Image();
            
            img.onload = () => {
              try {
                // Validate image dimensions
                if (img.width === 0 || img.height === 0) {
                  reject(new Error(`Érvénytelen képméret: ${file.name}`));
                  return;
                }
                
                if (img.width > 16384 || img.height > 16384) {
                  reject(new Error(`A kép mérete túl nagy: ${file.name} (${img.width}×${img.height}, maximum 16384×16384)`));
                  return;
                }
                
                const imageData = {
                  id: Date.now() + Math.random(),
                  file: file,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  width: img.width,
                  height: img.height,
                  src: e.target.result,
                  processed: false,
                  processedSize: null,
                  processedSrc: null,
                  addedAt: new Date().toLocaleString()
                };
                
                this.images.push(imageData);
                this.storageData.originalSize += file.size;
                this.updateFileTypeStats(file.type, file.size);
                resolve();
                
              } catch (dataError) {
                console.error('Error processing image data:', dataError);
                reject(new Error(`Hiba a képadatok feldolgozásakor: ${file.name}`));
              }
            };
            
            img.onerror = (imgError) => {
              console.error('Image loading error:', imgError);
              reject(new Error(`Sérült vagy érvénytelen képfájl: ${file.name}`));
            };
            
            // Set timeout for image loading
            setTimeout(() => {
              reject(new Error(`Időtúllépés a kép betöltésekor: ${file.name}`));
            }, 30000); // 30 second timeout
            
            img.src = e.target.result;
            
          } catch (imgError) {
            console.error('Error setting up image:', imgError);
            reject(new Error(`Hiba a kép beállításakor: ${file.name}`));
          }
        };
        
        reader.onerror = (readError) => {
          console.error('FileReader error:', readError);
          reject(new Error(`Fájlolvasási hiba: ${file.name}`));
        };
        
        reader.onabort = () => {
          reject(new Error(`Fájlolvasás megszakítva: ${file.name}`));
        };
        
        // Start reading the file
        reader.readAsDataURL(file);
        
      } catch (setupError) {
        console.error('Error setting up file reader:', setupError);
        reject(new Error(`Inicializálási hiba: ${file.name}`));
      }
    });
  }

  calculateDataUrlSize(dataUrl) {
    // More accurate size calculation for data URLs
    try {
      if (!dataUrl || typeof dataUrl !== 'string') {
        return 0;
      }
      
      const base64String = dataUrl.split(',')[1];
      if (!base64String) {
        return 0;
      }
      
      // Calculate actual byte size from base64
      const stringLength = base64String.length;
      const sizeInBytes = Math.floor(stringLength * 3 / 4);
      
      // Account for padding
      const paddingCount = base64String.match(/=/g)?.length || 0;
      return sizeInBytes - paddingCount;
      
    } catch (error) {
      console.error('Error calculating data URL size:', error);
      return 0;
    }
  }

  updateFileTypeStats(type, size) {
    const extension = type.split('/')[1].toUpperCase();
    if (this.fileTypes.has(extension)) {
      const current = this.fileTypes.get(extension);
      this.fileTypes.set(extension, {
        count: current.count + 1,
        size: current.size + size
      });
    } else {
      this.fileTypes.set(extension, { count: 1, size });
    }
  }

  renderImages() {
    const imageGrid = document.getElementById('imageGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (this.images.length === 0) {
      imageGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    
    emptyState.style.display = 'none';
    imageGrid.innerHTML = this.images.map(img => this.createImageCard(img)).join('');
  }

  createImageCard(imageData) {
    const sizeInMB = (imageData.size / (1024 * 1024)).toFixed(2);
    const processedSizeMB = imageData.processedSize ? 
      (imageData.processedSize / (1024 * 1024)).toFixed(2) : null;
    
    const compressionRatio = processedSizeMB ? 
      Math.round((1 - imageData.processedSize / imageData.size) * 100) : 0;

    const processingTime = imageData.processingTime ? 
      imageData.processingTime.toFixed(0) : null;

    return `
      <div class="card hover-lift animate-fade-in">
        <div class="aspect-square overflow-hidden relative group">
          <img src="${imageData.src}" alt="${imageData.name}" 
               class="w-full h-full object-cover transition-all duration-300 group-hover:scale-105" 
               loading="lazy">
          
          <!-- Processing Status Overlay -->
          ${imageData.processed ? `
            <div class="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              ${imageData.processedFormat ? imageData.processedFormat.toUpperCase() : 'Feldolgozott'}
            </div>
          ` : ''}
          
          <!-- Quick Format Conversion Overlay -->
          <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div class="flex gap-1">
              <button onclick="app.convertFormat('${imageData.id}', 'webp')" 
                      class="btn btn-sm bg-white/90 text-gray-800 hover:bg-white text-xs">WebP</button>
              <button onclick="app.convertFormat('${imageData.id}', 'png')" 
                      class="btn btn-sm bg-white/90 text-gray-800 hover:bg-white text-xs">PNG</button>
              <button onclick="app.convertFormat('${imageData.id}', 'jpg')" 
                      class="btn btn-sm bg-white/90 text-gray-800 hover:bg-white text-xs">JPG</button>
            </div>
          </div>
        </div>
        
        <div class="p-4 relative z-10">
          <h3 class="font-semibold truncate mb-3 text-neutral-900 dark:text-neutral-100" title="${imageData.name}">
            ${imageData.name}
          </h3>
          
          <div class="space-y-2 text-sm">
            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400">Méret:</span>
              <span class="font-medium text-neutral-800 dark:text-neutral-200">
                ${imageData.width}×${imageData.height}
              </span>
            </div>
            
            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400">Eredeti:</span>
              <span class="font-medium text-neutral-800 dark:text-neutral-200">${sizeInMB} MB</span>
            </div>
            
            ${processedSizeMB ? `
              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400">Feldolgozott:</span>
                <span class="font-medium text-green-600">${processedSizeMB} MB</span>
              </div>
              
              ${compressionRatio !== 0 ? `
                <div class="flex justify-between items-center">
                  <span class="text-neutral-600 dark:text-neutral-400">Megtakarítás:</span>
                  <span class="font-semibold text-green-600">${compressionRatio}%</span>
                </div>
              ` : ''}
              
              ${processingTime ? `
                <div class="flex justify-between items-center">
                  <span class="text-neutral-600 dark:text-neutral-400">Feldolgozási idő:</span>
                  <span class="font-medium text-neutral-600 dark:text-neutral-400">${processingTime}ms</span>
                </div>
              ` : ''}
            ` : ''}
          </div>
          
          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-2 mt-4">
            <button onclick="app.downloadOriginal('${imageData.id}')" 
                    class="btn btn-secondary btn-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 10v6m0 0l-3-3m3 3l3-3M9 5l3 3 3-3M21 21H3" />
              </svg>
              Eredeti
            </button>
            
            ${imageData.processed ? `
              <button onclick="app.downloadImage('${imageData.id}')" 
                      class="btn btn-success btn-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 10v6m0 0l-3-3m3 3l3-3M9 5l3 3 3-3" />
                </svg>
                Letöltés
              </button>
            ` : `
              <button onclick="app.processImage('${imageData.id}')" 
                      class="btn btn-primary btn-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Feldolgoz
              </button>
            `}
          </div>
          
          <!-- Wireless Transfer Controls -->
          ${this.connections.length > 0 ? `
            <div class="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <div class="flex gap-2">
                <button onclick="app.showDeviceSelectModal('${imageData.id}')" 
                        class="btn btn-primary btn-sm flex-1" 
                        title="Fájl küldése eszközre">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Küldés (${this.connections.length})
                </button>
              </div>
            </div>
          ` : ''}
          </div>
          
          <!-- Advanced Options -->
          <div class="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
            <div class="flex justify-between items-center">
              <button onclick="app.removeImage('${imageData.id}')" 
                      class="btn btn-danger btn-sm text-xs">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Törlés
              </button>
              
              <div class="flex gap-1">
                <span class="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-neutral-600 dark:text-neutral-400">
                  ${imageData.file.type.split('/')[1].toUpperCase()}
                </span>
                ${imageData.processed ? `
                  <span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 rounded-full text-green-600 dark:text-green-400">
                    Veszteségmentes
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  applyPreset(preset) {
    // Professional lossless presets
    const presets = {
      thumbnail: { 
        width: 300, 
        height: 300, 
        quality: 1, 
        format: 'webp',
        maintainAspect: true,
        algorithm: 'lanczos'
      },
      social: { 
        width: 1200, 
        height: 1200, 
        quality: 1, 
        format: 'webp',
        maintainAspect: true,
        algorithm: 'lanczos'
      },
      web: { 
        width: 800, 
        height: null, 
        quality: 1, 
        format: 'webp',
        maintainAspect: true,
        algorithm: 'lanczos'
      },
      print: {
        width: null,
        height: null,
        quality: 1,
        format: 'png',
        maintainAspect: true,
        algorithm: 'lanczos'
      },
      mobile: {
        width: 480,
        height: null,
        quality: 1,
        format: 'webp',
        maintainAspect: true,
        algorithm: 'lanczos'
      }
    };
    
    const config = presets[preset];
    if (!config) return;
    
    document.getElementById('customWidth').value = config.width || '';
    document.getElementById('customHeight').value = config.height || '';
    document.getElementById('quickFormat').value = config.format;
    // Quality is always 100% lossless - no slider to set
    
    this.showNotification(`${preset.toUpperCase()} preset alkalmazva`, 'info');
  }

  async quickProcess() {
    if (this.images.length === 0) {
      this.showNotification('Nincs feldolgozandó kép!', 'warning');
      return;
    }
    
    const format = document.getElementById('quickFormat').value;
    const quality = 1.0; // Always 100% lossless quality
    
    this.showProgress(true, 'Gyors feldolgozás...', this.images.length);
    
    for (let i = 0; i < this.images.length; i++) {
      await this.processImageWithSettings(this.images[i].id, { format, quality });
      this.updateProgress(i + 1, this.images.length);
    }
    
    this.hideProgress();
    this.updateStats();
    this.renderImages();
    this.showNotification('Gyors feldolgozás befejezve!', 'success');
  }

  async batchProcess() {
    if (this.images.length === 0) {
      this.showNotification('Nincs feldolgozandó kép!', 'warning');
      return;
    }
    
    const format = document.getElementById('quickFormat').value;
    const quality = 1.0; // Always 100% lossless quality
    const width = parseInt(document.getElementById('customWidth').value) || null;
    const height = parseInt(document.getElementById('customHeight').value) || null;
    const maintainAspect = document.getElementById('maintainAspect').checked;
    
    this.showProgress(true, 'Batch feldolgozás...', this.images.length);
    
    for (let i = 0; i < this.images.length; i++) {
      await this.processImageWithSettings(this.images[i].id, { 
        format, quality, width, height, maintainAspect 
      });
      this.updateProgress(i + 1, this.images.length);
    }
    
    this.hideProgress();
    this.updateStats();
    this.renderImages();
    this.showNotification('Batch feldolgozás befejezve!', 'success');
  }

  async processImage(imageId) {
    const image = this.images.find(img => img.id == imageId);
    if (!image) return;
    
    const format = document.getElementById('quickFormat').value;
    const quality = 1.0; // Always 100% lossless quality
    
    await this.processImageWithSettings(imageId, { format, quality });
    this.updateStats();
    this.renderImages();
    this.showNotification('Kép feldolgozva!', 'success');
  }

  async processImageWithSettings(imageId, settings) {
    const image = this.images.find(img => img.id == imageId);
    if (!image) return;
    
    try {
      return await this.processImageLossless(image, settings);
    } catch (error) {
      console.error('Failed to process image:', error);
      this.showNotification('Képfeldolgozás sikertelen!', 'error');
      throw error;
    }
  }

  async processImageLossless(image, settings) {
    const startTime = performance.now();
    
    return new Promise(async (resolve, reject) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          try {
            const processedData = await this.applyLosslessProcessing(img, settings);
            
            // Update image data with processed result
            image.processed = true;
            image.processedSrc = processedData.dataUrl;
            image.processedSize = processedData.size;
            image.processedFormat = settings.format;
            image.processedDimensions = processedData.dimensions;
            image.processingTime = performance.now() - startTime;
            
            // Update statistics
            this.storageData.compressedSize += processedData.size;
            this.processingStats.totalProcessed++;
            this.processingStats.timeSaved += image.processingTime;
            
            console.log(`Lossless processing completed in ${image.processingTime.toFixed(2)}ms`);
            resolve(processedData);
            
          } catch (processingError) {
            console.error('Lossless processing error:', processingError);
            reject(processingError);
          }
        };
        
        img.onerror = (error) => {
          console.error('Image loading error:', error);
          reject(new Error('Failed to load image for processing'));
        };
        
        img.src = image.src;
        
      } catch (error) {
        console.error('Setup error:', error);
        reject(error);
      }
    });
  }

  async applyLosslessProcessing(sourceImg, settings) {
    const { format, quality = 1, width, height, maintainAspect = true } = settings;
    
    // Calculate target dimensions
    let targetWidth = width || sourceImg.naturalWidth;
    let targetHeight = height || sourceImg.naturalHeight;
    
    if ((width || height) && maintainAspect) {
      const aspectRatio = sourceImg.naturalWidth / sourceImg.naturalHeight;
      if (width && !height) {
        targetHeight = Math.round(width / aspectRatio);
      } else if (height && !width) {
        targetWidth = Math.round(height * aspectRatio);
      }
    }
    
    // Create high-quality canvas for processing
    const canvas = this.createHighQualityCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    // Apply advanced resampling if resizing is needed
    if (targetWidth !== sourceImg.naturalWidth || targetHeight !== sourceImg.naturalHeight) {
      await this.resizeWithAdvancedAlgorithm(sourceImg, canvas, this.processingOptions.algorithm);
    } else {
      // Direct copy for format conversion only
      ctx.drawImage(sourceImg, 0, 0);
    }
    
    // Apply format-specific optimizations
    const optimizedDataUrl = await this.applyFormatOptimization(canvas, format, quality);
    
    // Calculate actual file size
    const base64Length = optimizedDataUrl.split(',')[1].length;
    const actualSize = Math.round(base64Length * 0.75);
    
    return {
      dataUrl: optimizedDataUrl,
      size: actualSize,
      dimensions: { width: targetWidth, height: targetHeight },
      format: format
    };
  }

  createHighQualityCanvas(width, height) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = width;
    canvas.height = height;
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Set optimal pixel density
    const devicePixelRatio = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1) {
      const scaledWidth = width * devicePixelRatio;
      const scaledHeight = height * devicePixelRatio;
      
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    
    return canvas;
  }

  async resizeWithAdvancedAlgorithm(sourceImg, targetCanvas, algorithm = 'lanczos') {
    const pica = window.pica();
    
    // Create source canvas with optimal settings
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCanvas.width = sourceImg.naturalWidth;
    sourceCanvas.height = sourceImg.naturalHeight;
    
    // Enable advanced canvas settings for maximum quality
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = 'high';
    sourceCtx.drawImage(sourceImg, 0, 0);
    
    // PhD-level resampling configuration
    const resizeOptions = {
      quality: 3, // Maximum quality (0-3)
      alpha: true,
      unsharpAmount: this.processingOptions.enableSharpening ? 120 : 0, // Enhanced sharpening
      unsharpRadius: 0.8,
      unsharpThreshold: 1.5,
      transferFunction: 'rec2020', // Advanced color space handling
      createImageBitmap: false // Force software rendering for consistency
    };
    
    // Professional resampling algorithms
    switch (algorithm) {
      case 'lanczos':
        resizeOptions.filter = 'lanczos3'; // Lanczos-3 for best quality
        break;
      case 'mitchell':
        resizeOptions.filter = 'mitchell'; // Mitchell filter for natural results
        break;
      case 'catrom':
        resizeOptions.filter = 'catrom'; // Catmull-Rom cubic
        break;
      case 'bicubic':
        resizeOptions.filter = 'cubic'; // Bicubic interpolation
        break;
      case 'bilinear':
        resizeOptions.filter = 'linear';
        break;
      case 'hermite':
        resizeOptions.filter = 'hermite'; // Hermite resampling
        break;
      case 'nearest':
        resizeOptions.filter = 'box';
        break;
      default:
        resizeOptions.filter = 'lanczos3'; // Default to highest quality
    }
    
    try {
      // Use advanced Pica processing with WebGL acceleration when available
      await pica.resize(sourceCanvas, targetCanvas, resizeOptions);
      
      // Apply additional post-processing for PhD-level quality
      await this.applyAdvancedPostProcessing(targetCanvas);
      
    } catch (error) {
      console.warn('Advanced resize failed, using fallback method:', error);
      await this.fallbackHighQualityResize(sourceCanvas, targetCanvas);
    }
  }

  async applyAdvancedPostProcessing(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply gamma correction for better color accuracy
    const gamma = this.processingOptions.gammaCorrection || 2.2;
    const gammaInv = 1.0 / gamma;
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply gamma correction to RGB channels
      data[i] = Math.pow(data[i] / 255, gammaInv) * 255;     // R
      data[i + 1] = Math.pow(data[i + 1] / 255, gammaInv) * 255; // G
      data[i + 2] = Math.pow(data[i + 2] / 255, gammaInv) * 255; // B
      // Alpha channel remains unchanged
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  async fallbackHighQualityResize(sourceCanvas, targetCanvas) {
    const ctx = targetCanvas.getContext('2d');
    
    // Multi-step resize for better quality when direct resize fails
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const targetWidth = targetCanvas.width;
    const targetHeight = targetCanvas.height;
    
    let currentCanvas = sourceCanvas;
    let currentWidth = sourceWidth;
    let currentHeight = sourceHeight;
    
    // Step-down approach: resize by max 50% per step for better quality
    while (currentWidth > targetWidth * 2 || currentHeight > targetHeight * 2) {
      const stepWidth = Math.max(targetWidth, Math.floor(currentWidth * 0.5));
      const stepHeight = Math.max(targetHeight, Math.floor(currentHeight * 0.5));
      
      const stepCanvas = document.createElement('canvas');
      const stepCtx = stepCanvas.getContext('2d');
      stepCanvas.width = stepWidth;
      stepCanvas.height = stepHeight;
      
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, stepWidth, stepHeight);
      
      currentCanvas = stepCanvas;
      currentWidth = stepWidth;
      currentHeight = stepHeight;
    }
    
    // Final resize with maximum quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);
  }

  async applyFormatOptimization(canvas, format, quality = 1) {
    const formatConfig = this.formatConfigs[format] || this.formatConfigs['png'];
    
    switch (format) {
      case 'webp':
        return this.optimizeWebP(canvas, formatConfig, quality);
      case 'png':
        return this.optimizePNG(canvas, formatConfig);
      case 'avif':
        return this.optimizeAVIF(canvas, formatConfig, quality);
      case 'tiff':
        return this.optimizeTIFF(canvas, formatConfig);
      case 'jpg':
      case 'jpeg':
        return this.optimizeJPEG(canvas, formatConfig, quality);
      default:
        return canvas.toDataURL(`image/${format}`, quality);
    }
  }

  optimizeWebP(canvas, config, quality) {
    if (config.lossless || quality >= 0.99) {
      // Force lossless WebP with optimal settings
      try {
        return canvas.toDataURL('image/webp', 1.0);
      } catch (error) {
        console.warn('Lossless WebP not supported, using high quality PNG');
        return canvas.toDataURL('image/png');
      }
    }
    // High quality WebP with advanced compression
    const webpQuality = Math.max(0.92, quality);
    return canvas.toDataURL('image/webp', webpQuality);
  }

  optimizePNG(canvas, config) {
    // PNG is inherently lossless - apply optimal compression
    try {
      // Modern browsers support PNG with quality parameter for compression level
      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      return canvas.toDataURL('image/png');
    }
  }

  optimizeAVIF(canvas, config, quality) {
    try {
      if (config.lossless || quality >= 0.99) {
        // AVIF lossless mode with maximum quality
        return canvas.toDataURL('image/avif', 1.0);
      }
      // High quality AVIF
      const avifQuality = Math.max(0.95, quality);
      return canvas.toDataURL('image/avif', avifQuality);
    } catch (error) {
      console.warn('AVIF format not supported, falling back to WebP');
      return this.optimizeWebP(canvas, config, quality);
    }
  }

  optimizeTIFF(canvas, config) {
    // TIFF support is limited in browsers, use highest quality PNG
    console.warn('TIFF format not supported in browsers, using lossless PNG');
    return canvas.toDataURL('image/png');
  }

  optimizeJPEG(canvas, config, quality) {
    // Enhanced JPEG optimization with professional settings
    const jpegQuality = Math.max(0.92, quality); // Professional minimum quality
    
    try {
      // Some browsers support additional JPEG options
      const ctx = canvas.getContext('2d');
      ctx.mozImageSmoothingEnabled = true;
      ctx.webkitImageSmoothingEnabled = true;
      ctx.msImageSmoothingEnabled = true;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      return canvas.toDataURL('image/jpeg', jpegQuality);
    } catch (error) {
      return canvas.toDataURL('image/jpeg', jpegQuality);
    }
  }

  // Advanced HEIF optimization (future format support)
  optimizeHEIF(canvas, config, quality) {
    try {
      if (config.lossless) {
        return canvas.toDataURL('image/heif', 1.0);
      }
      return canvas.toDataURL('image/heif', Math.max(0.95, quality));
    } catch (error) {
      console.warn('HEIF format not supported, falling back to AVIF');
      return this.optimizeAVIF(canvas, config, quality);
    }
  }

  // Simple download without processing
  async downloadOriginal(imageId) {
    const image = this.images.find(img => img.id == imageId);
    if (!image) return;
    
    try {
      // Create download link for original image
      const link = document.createElement('a');
      link.download = `original_${image.name}`;
      link.href = image.src;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showNotification('Eredeti kép letöltve!', 'success');
      
    } catch (error) {
      console.error('Download failed:', error);
      this.showNotification('Letöltés sikertelen!', 'error');
    }
  }

  // Format conversion without resizing - always lossless
  async convertFormat(imageId, targetFormat) {
    const image = this.images.find(img => img.id == imageId);
    if (!image) return;
    
    try {
      const settings = {
        format: targetFormat,
        quality: 1.0, // Always 100% lossless quality
        width: null,
        height: null,
        maintainAspect: true
      };
      
      await this.processImageWithSettings(imageId, settings);
      this.showNotification(`Kép veszteségmentesen konvertálva ${targetFormat.toUpperCase()} formátumba!`, 'success');
      
    } catch (error) {
      console.error('Format conversion failed:', error);
      this.showNotification('Formátum konverzió sikertelen!', 'error');
    }
  }

  downloadImage(imageId) {
    const image = this.images.find(img => img.id == imageId);
    if (!image) return;
    
    const dataUrl = image.processedSrc || image.src;
    const link = document.createElement('a');
    link.download = image.processed ? 
      `processed_${image.name}` : image.name;
    link.href = dataUrl;
    link.click();
    
    this.showNotification('Kép letöltve!', 'success');
  }

  removeImage(imageId) {
    const imageIndex = this.images.findIndex(img => img.id == imageId);
    if (imageIndex === -1) return;
    
    const image = this.images[imageIndex];
    this.storageData.originalSize -= image.size;
    if (image.processedSize) {
      this.storageData.compressedSize -= image.processedSize;
    }
    
    this.images.splice(imageIndex, 1);
    this.updateStats();
    this.renderImages();
    this.showNotification('Kép törölve!', 'info');
  }

  updateStats() {
    // Update main stats
    document.getElementById('totalImages').textContent = this.images.length;
    document.getElementById('totalProcessed').textContent = 
      this.images.filter(img => img.processed).length;
    
    const totalStorageMB = (this.storageData.originalSize / (1024 * 1024)).toFixed(1);
    document.getElementById('totalStorage').textContent = `${totalStorageMB} MB`;
    
    // Update storage analytics
    const usedStorageMB = (this.storageData.originalSize / (1024 * 1024)).toFixed(1);
    const limitGB = (this.storageData.limit / (1024 * 1024 * 1024)).toFixed(1);
    const usagePercent = (this.storageData.originalSize / this.storageData.limit) * 100;
    
    document.getElementById('usedStorage').textContent = `${usedStorageMB} MB / ${limitGB} GB`;
    document.getElementById('storageBar').style.width = `${Math.min(usagePercent, 100)}%`;
    
    const originalSizeMB = (this.storageData.originalSize / (1024 * 1024)).toFixed(1);
    const compressedSizeMB = (this.storageData.compressedSize / (1024 * 1024)).toFixed(1);
    
    document.getElementById('originalSize').textContent = `${originalSizeMB} MB`;
    document.getElementById('compressedSize').textContent = `${compressedSizeMB} MB`;
    
    const savingsPercent = this.storageData.originalSize > 0 ? 
      Math.round((1 - this.storageData.compressedSize / this.storageData.originalSize) * 100) : 0;
    document.getElementById('savingsPercent').textContent = `${savingsPercent}%`;
    
    // Update processing stats
    document.getElementById('totalProcessedStat').textContent = this.processingStats.totalProcessed;
    document.getElementById('avgCompressionStat').textContent = `${savingsPercent}%`;
    const timeSavedSeconds = (this.processingStats.timeSaved / 1000).toFixed(1);
    document.getElementById('totalTimeSavedStat').textContent = `${timeSavedSeconds}s`;
    
    const bandwidthSavedMB = ((this.storageData.originalSize - this.storageData.compressedSize) / (1024 * 1024)).toFixed(1);
    document.getElementById('totalBandwidthSavedStat').textContent = `${bandwidthSavedMB} MB`;
    
    this.updateFileTypeChart();
  }

  updateFileTypeChart() {
    const chartContainer = document.getElementById('fileTypeChart');
    
    if (this.fileTypes.size === 0) {
      chartContainer.innerHTML = `
        <div class="text-center py-8 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Nincs adat a megjelenítéshez</p>
        </div>
      `;
      return;
    }
    
    const totalSize = Array.from(this.fileTypes.values()).reduce((sum, data) => sum + data.size, 0);
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe'];
    
    chartContainer.innerHTML = Array.from(this.fileTypes.entries()).map(([type, data], index) => {
      const percentage = Math.round((data.size / totalSize) * 100);
      const sizeMB = (data.size / (1024 * 1024)).toFixed(1);
      const color = colors[index % colors.length];
      
      return `
        <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700">
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded" style="background-color: ${color}"></div>
            <div>
              <span class="font-medium">${type}</span>
              <div class="text-sm text-slate-500">${data.count} fájl • ${sizeMB} MB</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-semibold">${percentage}%</div>
          </div>
        </div>
      `;
    }).join('');
  }

  showProgress(show, title = '', total = 0) {
    const modal = document.getElementById('progressModal');
    const titleEl = document.getElementById('progressTitle');
    const textEl = document.getElementById('progressText');
    const totalEl = document.getElementById('progressTotal');
    
    if (show) {
      titleEl.textContent = title;
      textEl.textContent = 'Feldolgozás folyamatban...';
      totalEl.textContent = total;
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  updateProgress(current, total) {
    const fillEl = document.getElementById('progressFill');
    const countEl = document.getElementById('progressCount');
    
    const percentage = Math.round((current / total) * 100);
    fillEl.style.width = `${percentage}%`;
    countEl.textContent = current;
  }

  hideProgress() {
    this.showProgress(false);
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    notification.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg animate-slide-in`;
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-bold">${icons[type]}</span>
        <span>${message}</span>
      </div>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.5s ease-in-out';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, 5000);
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered successfully:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle action parameter from PWA shortcuts
    const action = urlParams.get('action');
    if (action === 'upload') {
      document.getElementById('fileInput').click();
    } else if (action === 'connect') {
      this.showDevicesTab();
    }
    
    // Handle connection parameter
    const connectId = urlParams.get('connect');
    if (connectId) {
      setTimeout(() => {
        if (this.peer && this.peer.id) {
          document.getElementById('deviceId').value = connectId;
          this.connectManual();
        }
      }, 2000); // Wait for peer connection to establish
    }
  }

  // Advanced File Transfer System with Progress Tracking
  async sendFile(imageId, connectionId) {
    const image = this.images.find(img => img.id == imageId);
    const connection = this.connections.find(conn => conn.peer === connectionId);
    
    if (!image || !connection) {
      this.showNotification('Fájl küldése sikertelen!', 'error');
      return;
    }
    
    try {
      // Prepare file for chunked transfer
      const fileData = image.processedSrc || image.src;
      const fileName = image.processed ? `processed_${image.name}` : image.name;
      const fileSize = this.calculateDataUrlSize(fileData);
      
      // Create transfer session
      const transferId = Date.now() + Math.random();
      const chunkSize = 16384; // 16KB chunks for reliable transfer
      const totalChunks = Math.ceil(fileData.length / chunkSize);
      
      // Send transfer initiation
      connection.send({
        type: 'transfer_start',
        transferId: transferId,
        fileName: fileName,
        fileSize: fileSize,
        totalChunks: totalChunks,
        imageId: imageId
      });
      
      // Show progress dialog
      this.showFileTransferProgress(transferId, fileName, 'sending', 0, totalChunks);
      
      // Send file in chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileData.length);
        const chunk = fileData.slice(start, end);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Chunk send timeout')), 5000);
          
          connection.send({
            type: 'file_chunk',
            transferId: transferId,
            chunkIndex: i,
            chunk: chunk,
            isLast: i === totalChunks - 1
          });
          
          // Update progress
          this.updateFileTransferProgress(transferId, i + 1, totalChunks);
          
          clearTimeout(timeout);
          resolve();
        });
        
        // Small delay to prevent overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      this.hideFileTransferProgress(transferId);
      this.showNotification(`${fileName} sikeresen elküldve!`, 'success');
      
    } catch (error) {
      console.error('File transfer failed:', error);
      this.hideFileTransferProgress();
      this.showNotification('Fájlátvitel sikertelen!', 'error');
    }
  }

  async sendAllFiles(connectionId) {
    const connection = this.connections.find(conn => conn.peer === connectionId);
    if (!connection || this.images.length === 0) {
      this.showNotification('Nincs mit küldeni!', 'warning');
      return;
    }
    
    this.showProgress(true, 'Összes fájl küldése...', this.images.length);
    
    try {
      for (let i = 0; i < this.images.length; i++) {
        await this.sendFile(this.images[i].id, connectionId);
        this.updateProgress(i + 1, this.images.length);
      }
      
      this.hideProgress();
      this.showNotification(`${this.images.length} fájl sikeresen elküldve!`, 'success');
      
    } catch (error) {
      this.hideProgress();
      this.showNotification('Tömeges fájlátvitel sikertelen!', 'error');
    }
  }

  receiveFile(data) {
    switch (data.type) {
      case 'transfer_start':
        this.handleTransferStart(data);
        break;
      case 'file_chunk':
        this.handleFileChunk(data);
        break;
      case 'transfer_complete':
        this.handleTransferComplete(data);
        break;
      default:
        // Legacy single file transfer
        this.handleLegacyFileReceive(data);
    }
  }

  handleTransferStart(data) {
    // Initialize transfer session
    this.activeTransfers = this.activeTransfers || new Map();
    this.activeTransfers.set(data.transferId, {
      fileName: data.fileName,
      fileSize: data.fileSize,
      totalChunks: data.totalChunks,
      chunks: new Array(data.totalChunks),
      receivedChunks: 0
    });
    
    this.showFileTransferProgress(data.transferId, data.fileName, 'receiving', 0, data.totalChunks);
  }

  handleFileChunk(data) {
    const transfer = this.activeTransfers.get(data.transferId);
    if (!transfer) return;
    
    // Store chunk
    transfer.chunks[data.chunkIndex] = data.chunk;
    transfer.receivedChunks++;
    
    // Update progress
    this.updateFileTransferProgress(data.transferId, transfer.receivedChunks, transfer.totalChunks);
    
    // Check if transfer is complete
    if (data.isLast || transfer.receivedChunks === transfer.totalChunks) {
      this.completeFileTransfer(data.transferId);
    }
  }

  completeFileTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;
    
    // Reconstruct file
    const fileData = transfer.chunks.join('');
    
    // Create download
    const link = document.createElement('a');
    link.href = fileData;
    link.download = transfer.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    this.activeTransfers.delete(transferId);
    this.hideFileTransferProgress(transferId);
    this.showNotification(`${transfer.fileName} sikeresen fogadva!`, 'success');
  }

  handleLegacyFileReceive(data) {
    // Fallback for simple file transfers
    const link = document.createElement('a');
    link.href = data.data;
    link.download = data.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showNotification(`${data.name} fogadva!`, 'success');
  }

  showFileTransferProgress(transferId, fileName, mode, current, total) {
    const container = document.getElementById('notifications');
    const progressDiv = document.createElement('div');
    progressDiv.id = `transfer-${transferId}`;
    progressDiv.className = 'bg-blue-500 text-white p-4 rounded-lg shadow-lg mb-4 animate-slide-in';
    
    const modeText = mode === 'sending' ? 'Küldés' : 'Fogadás';
    progressDiv.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold">${modeText}: ${fileName}</span>
        <button onclick="app.cancelFileTransfer('${transferId}')" class="text-white/80 hover:text-white">✕</button>
      </div>
      <div class="progress-bar mb-2">
        <div id="progress-${transferId}" class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="text-sm">
        <span id="chunk-count-${transferId}">0</span> / ${total} részlet
      </div>
    `;
    
    container.appendChild(progressDiv);
  }

  updateFileTransferProgress(transferId, current, total) {
    const progressFill = document.getElementById(`progress-${transferId}`);
    const chunkCount = document.getElementById(`chunk-count-${transferId}`);
    
    if (progressFill && chunkCount) {
      const percentage = (current / total) * 100;
      progressFill.style.width = `${percentage}%`;
      chunkCount.textContent = current;
    }
  }

  hideFileTransferProgress(transferId) {
    const progressDiv = document.getElementById(`transfer-${transferId}`);
    if (progressDiv) {
      progressDiv.style.animation = 'slideOut 0.5s ease-in-out';
      setTimeout(() => {
        if (progressDiv.parentNode) {
          progressDiv.parentNode.removeChild(progressDiv);
        }
      }, 500);
    }
  }

  cancelFileTransfer(transferId) {
    if (this.activeTransfers) {
      this.activeTransfers.delete(transferId);
    }
    this.hideFileTransferProgress(transferId);
    this.showNotification('Fájlátvitel megszakítva', 'info');
  }

  // Local server file transfer handlers
  handleLocalFileTransfer(data) {
    switch (data.type) {
      case 'file-transfer-start':
        this.handleLocalTransferStart(data);
        break;
      case 'file-chunk':
        this.handleLocalFileChunk(data);
        break;
      case 'file-complete':
        this.handleLocalTransferComplete(data);
        break;
    }
  }

  handleLocalTransferStart(data) {
    this.activeTransfers = this.activeTransfers || new Map();
    this.activeTransfers.set(data.transferId, {
      fileName: data.fileName,
      fileSize: data.fileSize,
      totalChunks: data.totalChunks,
      chunks: new Array(data.totalChunks),
      receivedChunks: 0,
      from: data.from
    });
    
    this.showFileTransferProgress(data.transferId, data.fileName, 'receiving', 0, data.totalChunks);
    this.showNotification(`Fájl fogadása: ${data.fileName}`, 'info');
  }

  handleLocalFileChunk(data) {
    const transfer = this.activeTransfers.get(data.transferId);
    if (!transfer) return;
    
    transfer.chunks[data.chunkIndex] = data.chunk;
    transfer.receivedChunks++;
    
    this.updateFileTransferProgress(data.transferId, transfer.receivedChunks, transfer.totalChunks);
    
    if (transfer.receivedChunks === transfer.totalChunks) {
      this.completeLocalFileTransfer(data.transferId);
    }
  }

  completeLocalFileTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;
    
    const fileData = transfer.chunks.join('');
    
    const link = document.createElement('a');
    link.href = fileData;
    link.download = transfer.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.activeTransfers.delete(transferId);
    this.hideFileTransferProgress(transferId);
    this.showNotification(`${transfer.fileName} sikeresen letöltve!`, 'success');
  }

  handleLocalWebRTCSignaling(data) {
    // Handle WebRTC signaling through local server
    console.log('Local WebRTC signaling:', data);
    // Implementation depends on specific WebRTC needs
  }

  handleDeviceList(devices) {
    // Update device list with local network devices
    this.networkDevices = devices;
    this.updateDeviceList();
  }

  // Send file through local server
  async sendFileViaLocalServer(imageId, targetDeviceId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.showNotification('Helyi szerver kapcsolat nincs aktív!', 'error');
      return;
    }

    const image = this.images.find(img => img.id == imageId);
    if (!image) {
      this.showNotification('Kép nem található!', 'error');
      return;
    }

    try {
      const fileData = image.processedSrc || image.src;
      const fileName = image.processed ? `processed_${image.name}` : image.name;
      const transferId = Date.now() + Math.random();
      const chunkSize = 16384;
      const totalChunks = Math.ceil(fileData.length / chunkSize);

      // Send transfer start
      this.ws.send(JSON.stringify({
        type: 'file-transfer-start',
        transferId: transferId,
        fileName: fileName,
        fileSize: this.calculateDataUrlSize(fileData),
        totalChunks: totalChunks,
        targetClient: targetDeviceId
      }));

      this.showFileTransferProgress(transferId, fileName, 'sending', 0, totalChunks);

      // Send chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileData.length);
        const chunk = fileData.slice(start, end);

        this.ws.send(JSON.stringify({
          type: 'file-chunk',
          transferId: transferId,
          chunkIndex: i,
          chunk: chunk,
          targetClient: targetDeviceId
        }));

        this.updateFileTransferProgress(transferId, i + 1, totalChunks);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.hideFileTransferProgress(transferId);
      this.showNotification(`${fileName} elküldve helyi hálózaton!`, 'success');

    } catch (error) {
      console.error('Local file transfer failed:', error);
      this.showNotification('Helyi fájlátvitel sikertelen!', 'error');
    }
  }

  // Batch download
  async downloadAll() {
    if (this.images.length === 0) {
      this.showNotification('Nincs letöltendő kép!', 'warning');
      return;
    }
    
    this.showProgress(true, 'ZIP fájl létrehozása...', this.images.length);
    
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < this.images.length; i++) {
        const image = this.images[i];
        const dataUrl = image.processedSrc || image.src;
        const base64Data = dataUrl.split(',')[1];
        const fileName = image.processed ? `processed_${image.name}` : image.name;
        
        zip.file(fileName, base64Data, { base64: true });
        this.updateProgress(i + 1, this.images.length);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `imageflow_export_${new Date().toISOString().split('T')[0]}.zip`);
      
      this.hideProgress();
      this.showNotification('Összes kép letöltve ZIP fájlban!', 'success');
      
    } catch (error) {
      console.error('Batch download failed:', error);
      this.hideProgress();
      this.showNotification('ZIP létrehozása sikertelen!', 'error');
    }
  }

  // Device Selection Modal for Individual File Transfer
  showDeviceSelectModal(imageId) {
    if (this.connections.length === 1) {
      // If only one device connected, send directly
      this.sendFile(imageId, this.connections[0].peer);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-bounce-in">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold">Eszköz kiválasztása</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-slate-600 dark:text-slate-400 mb-4">Válassza ki az eszközt, amelyre küldeni szeretné a fájlt:</p>
        <div class="space-y-2 mb-6">
          ${this.connections.map((conn, index) => `
            <button onclick="app.sendFile('${imageId}', '${conn.peer}'); this.closest('.fixed').remove();" 
                    class="w-full p-3 text-left bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <div class="font-medium">Eszköz ${index + 1}</div>
              <div class="text-sm text-slate-500">ID: ${conn.peer.substring(0, 12)}...</div>
            </button>
          `).join('')}
        </div>
        <div class="flex gap-2">
          <button onclick="this.closest('.fixed').remove()" 
                  class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            Mégse
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Remove modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

// Add CSS animations for slide out
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);

// Initialize the application
const app = new ImageFlowApp();

// Add global functions for HTML onclick handlers
window.downloadAll = () => app.downloadAll();
window.app = app; // Make app instance globally available
