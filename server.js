// server.js - Cập nhật logic xóa trả về 404 để Frontend xử lý key ma
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
let KeyModel;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Error:', err));

  const keySchema = new mongoose.Schema({
    id: String,
    key: String,
    type: String,
    status: String,
    createdAt: Number,
    expiresAt: Number,
    note: String
  });
  KeyModel = mongoose.model('LicenseKey', keySchema);
} else {
  console.log('⚠️ Running in MEMORY mode (No DB)');
}

let localKeys = [];

app.get('/', (req, res) => res.send('Server OK'));

app.get('/api/keys', async (req, res) => {
  if (KeyModel) {
    const keys = await KeyModel.find().sort({ createdAt: -1 });
    return res.json(keys);
  }
  res.json(localKeys);
});

app.post('/api/keys', async (req, res) => {
  const newKey = req.body;
  if (KeyModel) {
    const exists = await KeyModel.findOne({ key: newKey.key });
    if (!exists) await KeyModel.create(newKey);
    return res.json({ success: true, key: newKey });
  }
  localKeys.unshift(newKey);
  res.json({ success: true, key: newKey });
});

app.delete('/api/keys/:id', async (req, res) => {
  const { id } = req.params;
  
  if (KeyModel) {
    try {
      const result = await KeyModel.deleteOne({ id: id });
      
      // QUAN TRỌNG: Nếu không tìm thấy key để xóa (deletedCount == 0)
      // Trả về 404 để Frontend biết đây là "Key Ma" và tự xóa local đi.
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Key not found' });
      }
      
      console.log(`Deleted ID ${id}: count=${result.deletedCount}`);
      return res.json({ success: true, deleted: result.deletedCount });
    } catch (err) {
      console.error("Delete Error", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  
  // Local Memory Logic
  const initialLength = localKeys.length;
  localKeys = localKeys.filter(k => k.id !== id);
  if (localKeys.length === initialLength) {
     return res.status(404).json({ success: false, message: 'Key not found' });
  }
  res.json({ success: true });
});

app.post('/api/verify', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, message: 'Missing key' });
  const searchKey = key.toUpperCase();

  let foundKey;
  if (KeyModel) {
    foundKey = await KeyModel.findOne({ key: searchKey });
  } else {
    foundKey = localKeys.find(k => k.key === searchKey);
  }
  
  // NẾU KHÔNG TÌM THẤY -> TRẢ VỀ 403 ĐỂ CLIENT CHẶN
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
