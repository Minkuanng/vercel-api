// api/products/batch.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

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
    const { category, products } = req.body;

    // Validate
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: 'category is required and must be a non-empty string' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'products must be a non-empty array' });
    }

    const results = [];
    const errors = [];

    // Batch write
    const batch = db.batch();
    const timestamp = Date.now();

    for (const product of products) {
      try {
        const { name, price, data, icon = '📦', image = '', description = '' } = product;

        if (!name || typeof name !== 'string' || name.trim() === '') {
          errors.push({ error: 'name is required', product });
          continue;
        }

        if (!price || typeof price !== 'number' || price < 0) {
          errors.push({ error: 'price must be a positive number', product });
          continue;
        }

        if (!data || (typeof data !== 'string' || data.trim() === '')) {
          errors.push({ error: 'data is required', product });
          continue;
        }

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
          createdAt: timestamp,
          updatedAt: timestamp
        };

        batch.set(productRef, productData);
        results.push({ id: productRef.id, name: name.trim() });

      } catch (error) {
        errors.push({ error: error.message, product });
      }
    }

    // Commit batch
    if (results.length > 0) {
      await batch.commit();
    }

    return res.status(201).json({
      success: true,
      message: `Imported ${results.length} products, ${errors.length} failed`,
      data: {
        results,
        errors
      }
    });

  } catch (error) {
    console.error('Error in batch import:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};
