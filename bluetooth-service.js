// Bluetooth File Service for ImageFlow Pro
// Implements Web Bluetooth API for direct device-to-device file sharing

class BluetoothFileService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristics = new Map();
    this.connectedDevices = new Set();
    this.transferQueue = [];
    this.isTransferring = false;
    
    // Custom UUID for ImageFlow Pro service
    this.SERVICE_UUID = '12345678-1234-5678-9abc-123456789abc';
    this.CHARACTERISTICS = {
      FILE_INFO: '12345678-1234-5678-9abc-123456789ab1',
      FILE_DATA: '12345678-1234-5678-9abc-123456789ab2',
      TRANSFER_STATUS: '12345678-1234-5678-9abc-123456789ab3',
      DEVICE_INFO: '12345678-1234-5678-9abc-123456789ab4'
    };
  }

  async initialize() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API not supported');
      }

      console.log('🔵 Initializing Bluetooth service...');
      
      // Start advertising our service
      await this.startAdvertising();
      
      console.log('🔵 Bluetooth service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Bluetooth initialization failed:', error);
      throw error;
    }
  }

  async startAdvertising() {
    try {
      // Note: Web Bluetooth API currently doesn't support advertising
      // We'll use a different approach - scan for existing services
      console.log('🔵 Ready for Bluetooth connections');
      
      // Listen for availability changes
      navigator.bluetooth.addEventListener('availabilitychanged', (event) => {
        console.log(`Bluetooth availability: ${event.value}`);
      });
      
      return true;
    } catch (error) {
      console.error('Bluetooth advertising failed:', error);
      throw error;
    }
  }

  async scanForDevices() {
    try {
      console.log('🔵 Scanning for ImageFlow Pro devices...');
      
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] },
          { namePrefix: 'ImageFlow' }
        ],
        optionalServices: [this.SERVICE_UUID]
      });

      console.log('🔵 Found device:', device.name);
      return device;
      
    } catch (error) {
      if (error.name === 'NotFoundError') {
        console.log('🔵 No ImageFlow devices found or user cancelled');
      } else {
        console.error('Device scan failed:', error);
      }
      throw error;
    }
  }

  async connectToDevice(device) {
    try {
      this.device = device;
      
      // Add disconnect handler
      device.addEventListener('gattserverdisconnected', () => {
        console.log('🔵 Device disconnected');
        this.handleDeviceDisconnected(device);
      });

      console.log('🔵 Connecting to device...');
      this.server = await device.gatt.connect();
      
      console.log('🔵 Getting service...');
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      
      // Get all characteristics
      for (const [name, uuid] of Object.entries(this.CHARACTERISTICS)) {
        try {
          const characteristic = await this.service.getCharacteristic(uuid);
          this.characteristics.set(name, characteristic);
          
          // Enable notifications for status and data characteristics
          if (name === 'TRANSFER_STATUS' || name === 'FILE_DATA') {
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
              this.handleCharacteristicChanged(name, event);
            });
          }
        } catch (error) {
          console.warn(`Could not get characteristic ${name}:`, error);
        }
      }

      this.connectedDevices.add(device);
      console.log('🔵 Successfully connected to device');
      
      return true;
      
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }

  async sendFile(fileData, fileName, progressCallback) {
    try {
      if (!this.device || !this.device.gatt.connected) {
        throw new Error('No connected device');
      }

      console.log(`🔵 Sending file: ${fileName}`);
      
      // Prepare file info
      const fileInfo = {
        name: fileName,
        size: fileData.length,
        timestamp: Date.now(),
        chunks: Math.ceil(fileData.length / 512) // 512 bytes per chunk
      };

      // Send file info
      await this.writeCharacteristic('FILE_INFO', JSON.stringify(fileInfo));
      
      // Send file data in chunks
      const chunkSize = 512; // Bluetooth LE max is usually 20-512 bytes
      const totalChunks = Math.ceil(fileData.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileData.length);
        const chunk = fileData.slice(start, end);
        
        // Create chunk header
        const chunkData = new Uint8Array(chunk.length + 4);
        const view = new DataView(chunkData.buffer);
        view.setUint16(0, i); // Chunk index
        view.setUint16(2, chunk.length); // Chunk length
        
        // Copy chunk data
        for (let j = 0; j < chunk.length; j++) {
          chunkData[4 + j] = chunk.charCodeAt(j);
        }
        
        await this.writeCharacteristic('FILE_DATA', chunkData);
        
        // Update progress
        if (progressCallback) {
          progressCallback(i + 1, totalChunks, fileName);
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Send transfer complete status
      await this.writeCharacteristic('TRANSFER_STATUS', JSON.stringify({
        status: 'complete',
        fileName: fileName,
        timestamp: Date.now()
      }));
      
      console.log('🔵 File transfer completed');
      return true;
      
    } catch (error) {
      console.error('File transfer failed:', error);
      throw error;
    }
  }

  async writeCharacteristic(characteristicName, data) {
    try {
      const characteristic = this.characteristics.get(characteristicName);
      if (!characteristic) {
        throw new Error(`Characteristic ${characteristicName} not found`);
      }

      let buffer;
      if (typeof data === 'string') {
        buffer = new TextEncoder().encode(data);
      } else if (data instanceof Uint8Array) {
        buffer = data;
      } else {
        buffer = new TextEncoder().encode(JSON.stringify(data));
      }

      // Split into chunks if too large (max 512 bytes)
      const maxSize = 512;
      if (buffer.length <= maxSize) {
        await characteristic.writeValue(buffer);
      } else {
        for (let i = 0; i < buffer.length; i += maxSize) {
          const chunk = buffer.slice(i, i + maxSize);
          await characteristic.writeValue(chunk);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
    } catch (error) {
      console.error(`Write to ${characteristicName} failed:`, error);
      throw error;
    }
  }

  handleCharacteristicChanged(characteristicName, event) {
    const value = event.target.value;
    
    try {
      switch (characteristicName) {
        case 'TRANSFER_STATUS':
          const status = JSON.parse(new TextDecoder().decode(value));
          this.handleTransferStatus(status);
          break;
          
        case 'FILE_DATA':
          this.handleFileData(value);
          break;
          
        default:
          console.log(`🔵 Characteristic ${characteristicName} changed`);
      }
    } catch (error) {
      console.error('Characteristic change handler failed:', error);
    }
  }

  handleTransferStatus(status) {
    console.log('🔵 Transfer status:', status);
    
    // Notify the main app about transfer status
    if (window.app) {
      window.app.showNotification(
        `Bluetooth: ${status.status} - ${status.fileName}`,
        status.status === 'complete' ? 'success' : 'info'
      );
    }
  }

  handleFileData(data) {
    // Handle incoming file data
    console.log('🔵 Receiving file data chunk');
    
    // This would be expanded to reconstruct the file
    // For now, just log the data
  }

  handleDeviceDisconnected(device) {
    console.log('🔵 Device disconnected:', device.name);
    this.connectedDevices.delete(device);
    
    if (window.app) {
      window.app.showNotification('Bluetooth eszköz leválasztva', 'warning');
      window.app.updateDeviceList();
    }
  }

  async disconnect() {
    try {
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      
      this.device = null;
      this.server = null;
      this.service = null;
      this.characteristics.clear();
      this.connectedDevices.clear();
      
      console.log('🔵 Bluetooth disconnected');
      
    } catch (error) {
      console.error('Bluetooth disconnect failed:', error);
    }
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices).map(device => ({
      id: device.id,
      name: device.name || 'Unknown Device',
      connected: device.gatt?.connected || false
    }));
  }

  isSupported() {
    return 'bluetooth' in navigator;
  }

  async getAvailability() {
    try {
      return await navigator.bluetooth.getAvailability();
    } catch (error) {
      return false;
    }
  }

  // Generate a simple pairing code for manual connection
  generatePairingCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }
}

// Export for use in main application
if (typeof window !== 'undefined') {
  window.BluetoothFileService = BluetoothFileService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BluetoothFileService;
}