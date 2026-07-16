const admin = require('firebase-admin');

// Khởi tạo Firebase Admin 1 lần duy nhất (tránh lỗi "app already exists"
// khi Vercel tái sử dụng cùng 1 instance cho nhiều request).
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel lưu env dạng 1 dòng nên private key bị mất ký tự xuống dòng thật,
      // ta thay thế chuỗi "\n" bằng ký tự xuống dòng thật khi khởi tạo.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

module.exports = admin;
