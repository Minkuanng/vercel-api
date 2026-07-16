// api/shop/orders.js
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

  const { shop_id, token, limit = 20 } = req.query;

  if (!shop_id || !token) {
    return res.status(400).json({ success: false, error: 'missing_fields' });
  }

  try {
    // Xác thực đại lý
    const shopSnap = await db.ref(`shops/${shop_id}`).once('value');
    const shop = shopSnap.val();

    if (!shop) {
      return res.status(404).json({ success: false, error: 'shop_not_found' });
    }

    if (shop.token !== token) {
      return res.status(401).json({ success: false, error: 'invalid_token' });
    }

    // Lấy tất cả đơn hàng và lọc theo shop_id
    const ordersSnap = await db.ref('orders').once('value');
    const allOrders = ordersSnap.val() || {};

    let shopOrders = [];
    Object.keys(allOrders).forEach(key => {
      const order = allOrders[key];
      if (order.shop_id === shop_id) {
        shopOrders.push({
          order_code: order.order_code || `#${key.substring(0,6)}`,
          product_name: order.productName || 'Sản phẩm',
          quantity: order.quantity || 1,
          price: order.price || 0,
          status: order.status || 'success',
          timestamp: order.timestamp || Date.now()
        });
      }
    });

    // Sắp xếp theo thời gian giảm dần
    shopOrders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Giới hạn số lượng
    if (limit) {
      shopOrders = shopOrders.slice(0, parseInt(limit));
    }

    res.status(200).json({
      success: true,
      shop_id: shop_id,
      total: shopOrders.length,
      orders: shopOrders
    });

  } catch (error) {
    console.error('Lỗi khi lấy lịch sử đơn hàng:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
                                   }
