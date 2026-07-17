const { db, withCors } = require('../lib/firebase');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { category, products } = body;

  if (!category || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Cần "category" (string) và "products" (mảng, không rỗng)',
    });
  }

  const results = [];
  const errors = [];

  for (const item of products) {
    try {
      if (!item.name || item.price === undefined || !item.data) {
        errors.push({ name: item.name || '(không tên)', error: 'Thiếu name, price hoặc data' });
        continue;
      }

      const ref = db.ref('products').push();
      const newProduct = {
        name: item.name,
        price: Number(item.price),
        category,
        icon: item.icon || '📦',
        image: item.image || '',
        description: item.description || '',
        data: item.data,
        sold: 0,
        createdAt: Date.now(),
      };

      await ref.set(newProduct);
      results.push({ id: ref.key, name: newProduct.name });
    } catch (err) {
      errors.push({ name: item.name || '(không tên)', error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    message: `Imported ${results.length} products, ${errors.length} failed`,
    data: { results, errors },
  });
});
