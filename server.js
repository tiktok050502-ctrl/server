// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const DATA_FILE = 'keys.json';

// Hàm đọc dữ liệu từ file (Giúp key không mất khi Render restart)
const loadKeys = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (e) { return []; }
};

// Hàm lưu dữ liệu
const saveKeys = (keys) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(keys));
};

let keys = loadKeys();

// Root route check
app.get('/', (req, res) => {
  res.send('<h1>Server is RUNNING! 🚀</h1><p>Key count: ' + keys.length + '</p>');
});

app.get('/api/keys', (req, res) => {
  res.json(keys);
});

app.post('/api/keys', (req, res) => {
  const newKey = req.body;
  if (!keys.find(k => k.key === newKey.key)) {
     keys.push(newKey);
     saveKeys(keys); // Save to file
  }
  console.log('New key added:', newKey.key);
  res.json({ success: true, key: newKey });
});

app.delete('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  keys = keys.filter(k => k.id !== id);
  saveKeys(keys); // Save to file
  console.log('Deleted key ID:', id);
  res.json({ success: true });
});

app.post('/api/verify', (req, res) => {
  const { key } = req.body;
  
  if (!key) return res.status(400).json({ valid: false, message: 'Chưa nhập Key.' });

  const foundKey = keys.find(k => k.key === key.toUpperCase());
  
  if (!foundKey) {
    return res.status(403).json({ valid: false, message: 'Key không tồn tại hoặc đã bị xóa.' });
  }

  if (foundKey.expiresAt && Date.now() > foundKey.expiresAt) {
    return res.status(403).json({ valid: false, message: 'Key đã hết hạn.' });
  }

  res.json({ valid: true, expiresAt: foundKey.expiresAt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
