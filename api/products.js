// api/products.js
import admin from 'firebase-admin';
import { allowCors } from '../lib/cors.js';

// Khởi tạo Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } catch (error) {
    console.error('Firebase init error:', error);
  }
}
const db = admin.database();

const handler = async (req, res) => {
  // CORS handled by allowCors
  
  if (req.method === 'GET') {
    try {
      const snapshot = await db.ref('products').once('value');
      const products = snapshot.val() || {};
      
      // Chuyển đổi dữ liệu
      const productList = Object.keys(products).map(key => ({
        product_id: key,
        ...products[key],
        stock: products[key].data ? products[key].data.split('\n').filter(d => d.trim()).length : 0
      }));
      
      res.status(200).json({ 
        success: true, 
        total: productList.length, 
        products: productList 
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'server_error',
        message: error.message 
      });
    }
  } else if (req.method === 'POST') {
    // Xử lý POST nhập sản phẩm
    try {
      const { name, price, category, icon, image, description, data } = req.body;
      
      if (!name || !price || !category || !data) {
        return res.status(400).json({ 
          success: false, 
          error: 'missing_fields',
          message: 'Thiếu: name, price, category, data'
        });
      }

      const productData = {
        name,
        price: parseInt(price),
        category,
        icon: icon || '📦',
        image: image || '',
        description: description || '',
        data: Array.isArray(data) ? data.join('\n') : data,
        sold: 0,
        createdAt: Date.now()
      };

      const ref = db.ref('products').push();
      await ref.set(productData);
      
      res.status(200).json({ 
        success: true, 
        message: 'Product created successfully',
        productId: ref.key 
      });
    } catch (error) {
      console.error('POST error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'server_error',
        message: error.message 
      });
    }
  } else {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
};

export default allowCors(handler);
