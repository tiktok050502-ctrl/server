// server.js
const express = require('express');
const cors = require('cors');
const app = express();

// Cấu hình CORS chấp nhận tất cả (Để tránh lỗi Failed to fetch do chặn tên miền)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Giả lập Database trong bộ nhớ
let keys = [];

// [QUAN TRỌNG] Route trang chủ để kiểm tra server sống hay chết
app.get('/', (req, res) => {
  res.send('<h1>Server is RUNNING! 🚀</h1><p>Bạn đã deploy thành công. Hãy dùng link này dán vào App Chính.</p>');
});

// API: Lấy danh sách key (Dành cho Admin Panel)
app.get('/api/keys', (req, res) => {
  res.json(keys);
});

// API: Tạo key mới (Dành cho Admin Panel)
app.post('/api/keys', (req, res) => {
  const newKey = req.body;
  if (!keys.find(k => k.key === newKey.key)) {
     keys.push(newKey);
  }
  console.log('New key added:', newKey.key);
  res.json({ success: true, key: newKey });
});

// API: Xóa key (Dành cho Admin Panel)
app.delete('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  keys = keys.filter(k => k.id !== id);
  console.log('Deleted key ID:', id);
  res.json({ success: true });
});

// API: Xác thực key (Dành cho App Khách)
app.post('/api/verify', (req, res) => {
  const { key } = req.body;
  console.log('Verifying key:', key);
  
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
