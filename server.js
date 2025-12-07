// server.js - Phiên bản hỗ trợ MongoDB (Không bị mất dữ liệu)
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Cần: npm install mongoose
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// --- CẤU HÌNH DATABASE ---
// Trên Render: Vào "Environment Variables" thêm key: MONGO_URI
// Giá trị lấy từ MongoDB Atlas (miễn phí)
const MONGO_URI = process.env.MONGO_URI;

let KeyModel;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB Atlas'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

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
  console.log('⚠️ CẢNH BÁO: Chưa cấu hình MONGO_URI. Dữ liệu sẽ mất khi server restart.');
}

// --- BỘ NHỚ TẠM (FALLBACK KHI KHÔNG CÓ DB) ---
let localKeys = [];

// --- API ROUTES ---

app.get('/', (req, res) => {
  res.send('<h1>Server is RUNNING! 🚀</h1><p>' + (MONGO_URI ? 'Mode: MongoDB (Persistent)' : 'Mode: Memory (Temporary)') + '</p>');
});

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
    // Check duplicate
    const exists = await KeyModel.findOne({ key: newKey.key });
    if (!exists) {
      await KeyModel.create(newKey);
    }
    return res.json({ success: true, key: newKey });
  }
  
  // Local Fallback
  localKeys.unshift(newKey);
  res.json({ success: true, key: newKey });
});

app.delete('/api/keys/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Request Delete ID:', id);
  
  if (KeyModel) {
    // Thử xóa theo field 'id' (do frontend tạo)
    const result = await KeyModel.deleteOne({ id: id });
    
    // Nếu không xóa được (deletedCount = 0), có thể do dữ liệu cũ không có field 'id'
    // Hoặc người dùng gọi endpoint sai. Nhưng chúng ta vẫn trả về success để UI không bị treo.
    if (result.deletedCount === 0) {
        console.log('Warning: Key ID not found in DB or already deleted.');
    }
    return res.json({ success: true, deleted: result.deletedCount });
  }
  
  // Local Fallback
  localKeys = localKeys.filter(k => k.id !== id);
  res.json({ success: true });
});

app.post('/api/verify', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, message: 'Chưa nhập Key.' });
  const searchKey = key.toUpperCase();

  let foundKey;
  if (KeyModel) {
    foundKey = await KeyModel.findOne({ key: searchKey });
  } else {
    foundKey = localKeys.find(k => k.key === searchKey);
  }
  
  if (!foundKey) {
    // QUAN TRỌNG: Trả về 403/404 để client biết là key này KHÔNG TỒN TẠI
    // Client sẽ nhận tín hiệu này và CHẶN, không fallback offline nữa.
    return res.status(403).json({ valid: false, message: 'Key không tồn tại hoặc đã bị xóa.' });
  }

  // Kiểm tra blacklist (nếu bạn có triển khai status REVOKED)
  if (foundKey.status === 'REVOKED') {
     return res.status(403).json({ valid: false, message: 'Key đã bị khóa.' });
  }

  if (foundKey.expiresAt && Date.now() > foundKey.expiresAt) {
    return res.status(403).json({ valid: false, message: 'Key đã hết hạn.' });
  }

  res.json({ valid: true, expiresAt: foundKey.expiresAt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
