// api/categories.js
import admin from 'firebase-admin';
import { getCorsHeaders, handleCors } from '../lib/cors.js';

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

  try {
    // Lấy danh sách danh mục
    const catSnap = await db.ref('categories').once('value');
    const categoriesData = catSnap.val() || {};

    // Lấy danh sách sản phẩm để đếm số lượng
    const prodSnap = await db.ref('products').once('value');
    const productsData = prodSnap.val() || {};

    const categories = Object.keys(categoriesData).map(key => {
      const cat = categoriesData[key];
      // Đếm số sản phẩm thuộc danh mục này
      let count = 0;
      Object.keys(productsData).forEach(pKey => {
        if (productsData[pKey].category === key) count++;
      });

      return {
        category_id: key,
        name: cat.name || 'Chưa tên',
        icon: cat.icon || '📁',
        image: cat.image || '',
        product_count: count
      };
    });

    res.status(200).json({
      success: true,
      total: categories.length,
      categories
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
