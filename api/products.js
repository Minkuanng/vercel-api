// api/products.js
import admin from 'firebase-admin';
import { getCorsHeaders, handleCors } from '../lib/cors.js';

// --- Khởi tạo Firebase Admin (chỉ chạy 1 lần) ---
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
    } else {
      console.warn("⚠️ Biến môi trường Firebase chưa được cấu hình.");
    }
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin:', error);
  }
}
const db = admin.database();

export default async function handler(req, res) {
  // Xử lý CORS
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return handleCors(res);
  }

  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const snapshot = await db.ref('products').once('value');
    const productsData = snapshot.val();

    if (!productsData) {
      return res.status(200).json({ success: true, products: [], total: 0 });
    }

    const products = Object.keys(productsData).map(key => {
      const product = productsData[key];
      const dataArray = product.data ? product.data.split('\n').filter(d => d.trim() !== '') : [];
      return {
        product_id: key,
        name: product.name || 'Sản phẩm',
        price: product.price || 0,
        icon: product.icon || '📦',
        image: product.image || '',
        description: product.description || '',
        category: product.category || '',
        stock: dataArray.length,
        sold: product.sold || 0,
      };
    });

    res.status(200).json({ success: true, total: products.length, products });
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
