// api/product/[id].js
import admin from 'firebase-admin';
import { getCorsHeaders, handleCors } from '../../lib/cors.js';

// --- Khởi tạo Firebase Admin (giống như trên) ---
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin:', error);
  }
}
const db = admin.database();

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleCors(res);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  // Lấy product_id từ URL
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'missing_product_id' });
  }

  try {
    const snapshot = await db.ref(`products/${id}`).once('value');
    const product = snapshot.val();

    if (!product) {
      return res.status(404).json({ success: false, error: 'product_not_found' });
    }

    const dataArray = product.data ? product.data.split('\n').filter(d => d.trim() !== '') : [];
    const response = {
      success: true,
      product_id: id,
      name: product.name || 'Sản phẩm',
      price: product.price || 0,
      icon: product.icon || '📦',
      image: product.image || '',
      description: product.description || '',
      category: product.category || '',
      stock: dataArray.length,
      sold: product.sold || 0,
      data: dataArray, // Trả về cả dữ liệu chi tiết
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
