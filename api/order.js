// api/orders.js
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

  const { shop_id, limit = 50, token } = req.query;

  // Nếu có shop_id thì phải có token để xác thực
  if (shop_id && !token) {
    return res.status(401).json({ success: false, error: 'missing_token' });
  }

  try {
    let ordersRef = db.ref('orders');
    let ordersData = {};

    // Nếu có shop_id, kiểm tra token hợp lệ
    if (shop_id) {
      const shopSnap = await db.ref(`shops/${shop_id}`).once('value');
      const shop = shopSnap.val();
      if (!shop) {
        return res.status(404).json({ success: false, error: 'shop_not_found' });
      }
      if (shop.token !== token) {
        return res.status(401).json({ success: false, error: 'invalid_token' });
      }
      if (shop.status === 'banned') {
        return res.status(403).json({ success: false, error: 'shop_banned' });
      }

      // Lọc đơn hàng theo shop_id (cần thêm chỉ mục trong Firebase)
      // Cách đơn giản: lấy tất cả và lọc ở đây (không hiệu quả với lượng lớn)
      const snapshot = await ordersRef.once('value');
      const allOrders = snapshot.val() || {};
      Object.keys(allOrders).forEach(key => {
        if (allOrders[key].shop_id === shop_id) {
          ordersData[key] = allOrders[key];
        }
      });
    } else {
      const snapshot = await ordersRef.once('value');
      ordersData = snapshot.val() || {};
    }

    // Chuyển đổi và sắp xếp
    let orders = Object.keys(ordersData).map(key => ({
      order_id: key,
      ...ordersData[key]
    }));

    // Sắp xếp theo thời gian giảm dần
    orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Giới hạn số lượng
    if (limit) {
      orders = orders.slice(0, parseInt(limit));
    }

    res.status(200).json({
      success: true,
      total: orders.length,
      orders
    });

  } catch (error) {
    console.error('Lỗi khi lấy đơn hàng:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
