// Bluetooth File Service for ImageFlow Pro
// Implements Web Bluetooth API for device discovery and simple file transfer

class BluetoothFileService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristics = new Map();
    this.connectedDevices = new Set();
    this.transferQueue = [];
    this.isTransferring = false;

    // Custom UUIDs for ImageFlow Pro service (placeholder values)
    this.SERVICE_UUID = '12345678-1234-5678-9abc-123456789abc';
    this.CHARACTERISTICS = {
      FILE_INFO: '12345678-1234-5678-9abc-123456789ab1',
      FILE_DATA: '12345678-1234-5678-9abc-123456789ab2',
      TRANSFER_STATUS: '12345678-1234-5678-9abc-123456789ab3',
      DEVICE_INFO: '12345678-1234-5678-9abc-123456789ab4'
    };
  }

  async initialize() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth API not supported');
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn('Bluetooth works only in secure contexts (HTTPS or localhost).');
    }
    console.log('Initializing Bluetooth service...');
    await this.startAdvertising();
    console.log('Bluetooth service initialized successfully');
    return true;
  }

  async startAdvertising() {
    // Browsers cannot advertise as a BLE peripheral.
    // We prepare to scan/connect and listen for availability changes.
    navigator.bluetooth.addEventListener('availabilitychanged', (event) => {
      console.log(`Bluetooth availability: ${event.value}`);
    });
    console.log('Ready for Bluetooth connections');
    return true;
  }

  async scanForDevices() {
    console.log('Scanning for Bluetooth devices...');

    // Prefer previously paired devices to avoid prompts
    try {
      const known = await this.getPairedDevices();
      if (known && known.length) {
        console.log(`Found ${known.length} previously paired device(s)`);
        return known[0];
      }
    } catch (_) {}

    // Primary: try by custom service or name prefix
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] },
          { namePrefix: 'ImageFlow' }
        ],
        optionalServices: [this.SERVICE_UUID, 'device_information', 'battery_service']
      });
      console.log('Found device:', device.name || device.id);
      return device;
    } catch (errPrimary) {
      if (errPrimary && errPrimary.name !== 'NotFoundError') throw errPrimary;
      // Fallback: widen scope (user selects from list)
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID, 'device_information', 'battery_service']
      });
      console.log('Selected device:', device.name || device.id);
      return device;
    }
  }

  async connectToDevice(device) {
    this.device = device;

    device.addEventListener('gattserverdisconnected', () => {
      console.log('Device disconnected');
      this.handleDeviceDisconnected(device);
    });

    console.log('Connecting to device...');
    this.server = await device.gatt.connect();

    console.log('Getting primary service...');
    // Try custom service first
    try {
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
    } catch (_) {
      // Try a common service so the connection is still established
      try {
        this.service = await this.server.getPrimaryService('device_information');
      } catch (_) {
        // If neither available, proceed — some devices may expose only notify characteristics
      }
    }

    // Try to resolve characteristics if custom service is available
    if (this.service) {
      for (const [name, uuid] of Object.entries(this.CHARACTERISTICS)) {
        try {
          const characteristic = await this.service.getCharacteristic(uuid);
          this.characteristics.set(name, characteristic);
          if (name === 'TRANSFER_STATUS' || name === 'FILE_DATA') {
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
              this.handleCharacteristicChanged(name, event);
            });
          }
        } catch (_) {
          // Characteristic not available on this device
        }
      }
    }

    this.connectedDevices.add(device);
    console.log('Successfully connected to device');
    return true;
  }

  async sendFile(fileData, fileName, progressCallback) {
    if (!this.characteristics.has('FILE_INFO') || !this.characteristics.has('FILE_DATA')) {
      throw new Error('Bluetooth file transfer not supported by the target device');
    }

    try {
      // Send file info (name, size)
      const info = { fileName, size: fileData.length, timestamp: Date.now() };
      await this.writeCharacteristic('FILE_INFO', JSON.stringify(info));

      const chunkSize = 512; // typical upper bound for BLE write
      const totalChunks = Math.ceil(fileData.length / chunkSize);

      for (let i = 0; i < fileData.length; i += chunkSize) {
        const chunk = fileData.slice(i, i + chunkSize);
        await this.writeCharacteristic('FILE_DATA', chunk);
        if (progressCallback) progressCallback(Math.min(i + chunkSize, fileData.length), fileData.length, fileName);
        await new Promise(r => setTimeout(r, 8));
      }

      await this.writeCharacteristic('TRANSFER_STATUS', JSON.stringify({ status: 'complete', fileName, timestamp: Date.now() }));
      console.log('File transfer completed');
      return true;
    } catch (error) {
      console.error('File transfer failed:', error);
      throw error;
    }
  }

  async writeCharacteristic(characteristicName, data) {
    const characteristic = this.characteristics.get(characteristicName);
    if (!characteristic) throw new Error(`Characteristic ${characteristicName} not found`);

    let buffer;
    if (typeof data === 'string') {
      buffer = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      buffer = data;
    } else {
      buffer = new TextEncoder().encode(JSON.stringify(data));
    }

    const max = 512;
    if (buffer.length <= max) {
      await characteristic.writeValue(buffer);
    } else {
      for (let i = 0; i < buffer.length; i += max) {
        const chunk = buffer.slice(i, i + max);
        await characteristic.writeValue(chunk);
        await new Promise(r => setTimeout(r, 8));
      }
    }
  }

  handleCharacteristicChanged(characteristicName, event) {
    const value = event.target.value;
    try {
      switch (characteristicName) {
        case 'TRANSFER_STATUS':
          try {
            const status = JSON.parse(new TextDecoder().decode(value));
            this.handleTransferStatus(status);
          } catch (_) {}
          break;
        case 'FILE_DATA':
          this.handleFileData(value);
          break;
        default:
          console.log(`Characteristic ${characteristicName} changed`);
      }
    } catch (error) {
      console.error('Characteristic change handler failed:', error);
    }
  }

  handleTransferStatus(status) {
    console.log('Transfer status:', status);
    if (typeof window !== 'undefined' && window.app) {
      window.app.showNotification(
        `Bluetooth: ${status.status} - ${status.fileName || ''}`,
        status.status === 'complete' ? 'success' : 'info'
      );
    }
  }

  handleFileData(data) {
    // Receiver-side reconstruction would go here (not implemented for web-only peer)
    console.log('Receiving file data chunk');
  }

  handleDeviceDisconnected(device) {
    this.connectedDevices.delete(device);
    if (typeof window !== 'undefined' && window.app) {
      window.app.showNotification('Bluetooth eszköz leválasztva', 'warning');
      window.app.updateDeviceList && window.app.updateDeviceList();
    }
  }

  async disconnect() {
    try {
      if (this.device && this.device.gatt?.connected) {
        await this.device.gatt.disconnect();
      }
    } catch (_) {}
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristics.clear();
    this.connectedDevices.clear();
    console.log('Bluetooth disconnected');
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices).map(d => ({ id: d.id, name: d.name || 'Unknown Device', connected: !!(d.gatt && d.gatt.connected) }));
  }

  isSupported() {
    return 'bluetooth' in navigator;
  }

  async getAvailability() {
    try { return await navigator.bluetooth.getAvailability(); } catch (_) { return false; }
  }

  async getPairedDevices() {
    try {
      if (!navigator.bluetooth.getDevices) return [];
      const devices = await navigator.bluetooth.getDevices();
      return devices || [];
    } catch (_) { return []; }
  }

  async autoReconnect() {
    try {
      const devices = await this.getPairedDevices();
      for (const dev of devices) {
        try {
          await this.connectToDevice(dev);
          return true;
        } catch (_) {}
      }
      return false;
    } catch (_) { return false; }
  }

  // Simple pairing code helper
  generatePairingCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.BluetoothFileService = BluetoothFileService;
}

// Export for Node (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BluetoothFileService;
}

