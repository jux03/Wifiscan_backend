const express = require('express');
const cors = require('cors');
const wifi = require('node-wifi');
const noble = require('@abandonware/noble');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const db = require('./config/db');

// Initialize App
const app = express();
app.use(express.json());
app.use(cors());

// Initialize Wi-Fi library
wifi.init({ iface: null }); // Use default network interface

// CSV Writer Configuration
const writer = csvWriter({
  path: 'scan_results.csv',
  append: true, // Append new scans to the CSV file
  header: [
    { id: 'type', title: 'TYPE' },
    { id: 'name', title: 'NAME' },
    { id: 'address', title: 'ADDRESS' },
    { id: 'signals', title: 'SIGNAL' },
    { id: 'frequency', title: 'FREQUENCY' },
    { id: 'timestamp', title: 'TIMESTAMP' },
  ],
});

// Helper function to add a timestamp
const addTimestamp = (records) => {
  const timestamp = new Date().toISOString();
  return records.map((record) => ({ ...record, timestamp }));
};

// Wi-Fi Scanning
app.get('/api/scan-wifi', async (req, res) => {
  try {
    const networks = await wifi.scan();
    const detailedNetworks = addTimestamp(
      networks.map((network) => ({
        type: 'WiFi',
        name: network.ssid,
        address: network.bssid || 'N/A',
        signals: network.signal_level,
        frequency: network.frequency,
      }))
    );

    await writer.writeRecords(detailedNetworks);
    console.log('Wi-Fi data logged to CSV');
    res.json(detailedNetworks);
  } catch (error) {
    console.error('Failed to scan Wi-Fi networks:', error);
    res.status(500).json({ error: 'Failed to scan Wi-Fi networks' });
  }
});

// Bluetooth Scanning
app.get('/api/scan-bluetooth', (req, res) => {
  const devices = [];

  noble.on('discover', (peripheral) => {
    devices.push({
      type: 'Bluetooth',
      name: peripheral.advertisement.localName || 'Unknown',
      address: peripheral.address || 'N/A',
      signals: peripheral.rssi,
      frequency: 'N/A',
    });
  });

  noble.startScanning();

  setTimeout(async () => {
    noble.stopScanning();

    const detailedDevices = addTimestamp(devices);
    await writer.writeRecords(detailedDevices).catch((err) =>
      console.error('Error logging Bluetooth data:', err)
    );
    console.log('Bluetooth data logged to CSV');

    res.json(detailedDevices);
  }, 10000);
});

// Mobile Network Scanning (Mocked Example)
app.get('/api/scan-mobile', async (req, res) => {
  try {
    const mobileData = addTimestamp([
      {
        type: 'Mobile',
        name: 'Cell Tower',
        address: 'Tower ID 12345',
        signals: -85, // dBm
        frequency: '1800 MHz',
      },
    ]);

    await writer.writeRecords(mobileData);
    console.log('Mobile network data logged to CSV');

    res.json(mobileData);
  } catch (error) {
    console.error('Failed to scan mobile network:', error);
    res.status(500).json({ error: 'Failed to scan mobile network' });
  }
});

// Unified Scanning
app.get('/api/scan-all', async (req, res) => {
  try {
    const wifiPromise = wifi.scan();
    const bluetoothDevices = [];
    const bluetoothPromise = new Promise((resolve) => {
      noble.on('discover', (peripheral) => {
        bluetoothDevices.push({
          type: 'Bluetooth',
          name: peripheral.advertisement.localName || 'Unknown',
          address: peripheral.address || 'N/A',
          signals: peripheral.rssi,
          frequency: 'N/A',
        });
      });

      noble.startScanning();

      setTimeout(() => {
        noble.stopScanning();
        resolve(addTimestamp(bluetoothDevices));
      }, 10000);
    });

    const mobileData = addTimestamp([
      {
        type: 'Mobile',
        name: 'Cell Tower',
        address: 'Tower ID 12345',
        signals: -85, // dBm
        frequency: '1800 MHz',
      },
    ]);

    const [wifiData, bluetoothData] = await Promise.all([wifiPromise, bluetoothPromise]);

    const detailedWifi = addTimestamp(
      wifiData.map((network) => ({
        type: 'WiFi',
        name: network.ssid,
        address: network.bssid || 'N/A',
        signals: network.signal_level,
        frequency: network.frequency,
      }))
    );

    const allData = [...detailedWifi, ...bluetoothData, ...mobileData];
    await writer.writeRecords(allData);
    console.log('All data logged to CSV');

    res.json(allData);
  } catch (error) {
    console.error('Failed to perform unified scan:', error);
    res.status(500).json({ error: 'Failed to perform unified scan' });
  }
});

// Save scanned data to MySQL
app.post('/api/save', (req, res) => {
  const { type, name, address, signals, frequency } = req.body;
  const query = 'INSERT INTO scans (type, name, address, signals, frequency) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [type, name, address, signals, frequency], (err) => {
    if (err) {
      console.error('Failed to save scan data:', err);
      return res.status(500).json({ error: 'Failed to save scan data' });
    }
    res.status(201).json({ message: 'Scan data saved successfully' });
  });
});

// Fetch saved scans
app.get('/api/scans', (req, res) => {
  const query = 'SELECT * FROM scans';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch scan data:', err);
      return res.status(500).json({ error: 'Failed to fetch scan data' });
    }
    res.json(results);
  });
});

// Start Server
const PORT = 4800;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
