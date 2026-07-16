// api/products.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Khởi tạo Firebase Admin nếu chưa có
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = getFirestore();

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST'] });
  }

  try {
    const { name, price, category, data, icon = '📦', image = '', description = '' } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }

    if (!price || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'price is required and must be a positive number' });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: 'category is required and must be a non-empty string' });
    }

    if (!data || (typeof data !== 'string' || data.trim() === '')) {
      return res.status(400).json({ error: 'data is required and must be a non-empty string' });
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
      error: 'Internal Server Error',
      message: error.message
    });
  }
};
