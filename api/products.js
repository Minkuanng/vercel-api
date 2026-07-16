// api/products.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Khởi tạo Firebase Admin - BẮT BUỘC PHẢI CÓ
if (!admin.apps.length) {
  try {
    // Kiểm tra biến môi trường
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY || 
        !process.env.FIREBASE_DATABASE_URL) {
      console.error('Missing Firebase environment variables');
    }

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

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Xử lý preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ============ GET - Lấy danh sách sản phẩm ============
  if (req.method === 'GET') {
    try {
      const { category, limit = 50 } = req.query;

      let query = db.collection('products');

      if (category) {
        query = query.where('category', '==', category);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .get();

      const products = [];
      snapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
      });

      return res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });

    } catch (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }

  // ============ POST - Tạo sản phẩm mới ============
  if (req.method === 'POST') {
    try {
      const { 
        name, 
        price, 
        category, 
        data, 
        icon = '📦', 
        image = '', 
        description = '' 
      } = req.body;

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ 
          success: false,
          error: 'name is required and must be a non-empty string' 
        });
      }

      if (!price || typeof price !== 'number' || price < 0) {
        return res.status(400).json({ 
          success: false,
          error: 'price is required and must be a positive number' 
        });
      }

      if (!category || typeof category !== 'string' || category.trim() === '') {
        return res.status(400).json({ 
          success: false,
          error: 'category is required and must be a non-empty string' 
        });
      }

      if (!data || (typeof data !== 'string' || data.trim() === '')) {
        return res.status(400).json({ 
          success: false,
          error: 'data is required and must be a non-empty string' 
        });
      }

      // Tạo document mới trong Firestore
      const productRef = db.collection('products').doc();
      const productData = {
        id: productRef.id,
        name: name.trim(),
        price: Number(price),
        category: category.trim(),
        data: data.trim(),
        icon: icon.trim() || '📦',
        image: image.trim() || '',
        description: description.trim() || '',
        sold: 0,
        stock: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await productRef.set(productData);

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        productId: productRef.id,
        data: productData
      });

    } catch (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }

  // Nếu method không được hỗ trợ
  return res.status(405).json({ 
    success: false,
    error: 'Method Not Allowed', 
    allowed: ['GET', 'POST'] 
  });
};
