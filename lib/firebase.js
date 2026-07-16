const admin = require('firebase-admin');

// Khởi tạo Firebase Admin CHỈ MỘT LẦN (tránh lỗi "app already exists" khi
// Vercel tái sử dụng cùng 1 instance serverless cho nhiều request)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Trên Vercel, private key được lưu với \n đã escape thành \\n
  // => cần .replace(/\\n/g, '\n') để chuyển lại thành xuống dòng thật
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    console.error('❌ Thiếu biến môi trường Firebase. Cần đủ 4 biến: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL,
  });
}

const db = admin.database();

// Bật CORS cho mọi route để admin.html (chạy ở domain khác) gọi được API
function withCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      await handler(req, res);
    } catch (err) {
      console.error('🔥 Unhandled API error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
      }
    }
  };
}

// Lấy thông tin đại lý (shop) theo token gửi lên từ query ?token= hoặc header Authorization: Bearer
async function getShopByToken(req) {
  const token =
    (req.query && req.query.token) ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);

  if (!token) return { error: 'Missing token', shop: null, shopId: null };

  const snapshot = await db.ref('shops').once('value');
  const shops = snapshot.val() || {};
  const shopId = Object.keys(shops).find((key) => shops[key].token === token);

  if (!shopId) return { error: 'Invalid token', shop: null, shopId: null };

  const shop = shops[shopId];
  if (shop.status === 'banned') return { error: 'Shop is banned', shop: null, shopId: null };

  return { error: null, shop, shopId };
}

module.exports = { admin, db, withCors, getShopByToken };
