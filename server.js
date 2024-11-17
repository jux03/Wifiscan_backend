const express = require('express');
const cors = require('cors');
const wifi = require('node-wifi');
const db = require('./config/db');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Wi-Fi library
wifi.init({ iface: null }); // Use default network interface

// API: Scan networks
app.get('/api/scan', async (req, res) => {
    try {
      const networks = await wifi.scan();
  
      // Add extra details (mocked or calculated) if not provided by the library
      const detailedNetworks = networks.map((network) => ({
        ...network,
        channel: network.frequency ? Math.round(network.frequency / 5 - 2407 / 5) : 'N/A', // Example calculation
        encryption: network.security || 'Unknown',
        macAddress: network.bssid || 'N/A',
        vendor: 'Unknown Vendor', // You can add real vendor detection logic here
      }));
  
      res.json(detailedNetworks);
    } catch (error) {
      console.error('Failed to scan networks:', error);
      res.status(500).json({ error: 'Failed to scan networks' });
    }
  });
  

// API: Save network to MySQL
app.post('/api/save', (req, res) => {
  const { ssid, bssid, signal, frequency } = req.body;
  const query = 'INSERT INTO networks (ssid, bssid, signal, frequency) VALUES (?, ?, ?, ?)';
  db.query(query, [ssid, bssid, signal, frequency], (err) => {
    if (err) {
      console.error('Failed to save network:', err);
      return res.status(500).json({ error: 'Failed to save network' });
    }
    res.status(201).json({ message: 'Network saved successfully' });
  });
});

// API: Fetch saved networks
app.get('/api/networks', (req, res) => {
  const query = 'SELECT * FROM networks';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch networks:', err);
      return res.status(500).json({ error: 'Failed to fetch networks' });
    }
    res.json(results);
  });
});

// Start the server
const PORT = 4800;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
