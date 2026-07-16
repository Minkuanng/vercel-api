// api/products.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// --- Khởi tạo Firebase ---
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}
const db = getFirestore();

// --- Handler chính ---
module.exports = async (req, res) => {
  // --- Tự xử lý CORS (Không cần import từ lib) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ============ GET ============
  if (req.method === 'GET') {
    // ... (giữ nguyên code GET của bạn)
  }

  // ============ POST ============
  if (req.method === 'POST') {
    // ... (giữ nguyên code POST của bạn, nhớ kiểm tra validate)
  }

  // ============ Method Not Allowed ============
  return res.status(405).json({ 
    error: 'Method Not Allowed', 
    allowed: ['GET', 'POST'] 
  });
};
