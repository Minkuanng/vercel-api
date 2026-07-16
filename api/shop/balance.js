// api/shop/balance.js
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

  const { shop_id, token } = req.query;

  if (!shop_id || !token) {
    return res.status(400).json({ success: false, error: 'missing_fields' });
  }

  try {
    const shopSnap = await db.ref(`shops/${shop_id}`).once('value');
    const shop = shopSnap.val();

    if (!shop) {
      return res.status(404).json({ success: false, error: 'shop_not_found' });
    }

    if (shop.token !== token) {
      return res.status(401).json({ success: false, error: 'invalid_token' });
    }

    res.status(200).json({
      success: true,
      shop_id: shop_id,
      name: shop.name || '',
      balance: shop.balance || 0,
      status: shop.status || 'active',
      total_orders: shop.totalOrders || 0,
      total_spent: shop.totalSpent || 0
    });

  } catch (error) {
    console.error('Lỗi khi kiểm tra số dư:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
