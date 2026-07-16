// api/products.js
import { allowCors } from '../lib/cors.js';

const handler = async (req, res) => {
  if (req.method === 'GET') {
    // Lấy danh sách sản phẩm từ Firebase
    const admin = require('firebase-admin');
    const db = admin.database();
    const snapshot = await db.ref('products').once('value');
    res.json({ success: true, data: snapshot.val() });
  }
  
  if (req.method === 'POST') {
    // Nhập sản phẩm mới
    const { name, price, category, icon, image, description, data } = req.body;
    
    // Validate
    if (!name || !price || !category || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu trường bắt buộc: name, price, category, data' 
      });
    }

    // Lưu vào Firebase
    const admin = require('firebase-admin');
    const db = admin.database();
    const ref = db.ref('products').push();
    await ref.set({
      name,
      price: parseInt(price),
      category,
      icon: icon || '📦',
      image: image || '',
      description: description || '',
      data: Array.isArray(data) ? data.join('\n') : data,
      sold: 0,
      createdAt: Date.now()
    });

    res.json({ success: true, message: 'Đã nhập sản phẩm!', productId: ref.key });
  }
};

export default allowCors(handler);
