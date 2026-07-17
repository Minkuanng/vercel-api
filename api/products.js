const { db, withCors } = require('../lib/firebase');

module.exports = withCors(async (req, res) => {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' });
});

// ===== GET /api/products =====
async function handleGet(req, res) {
  const { category, limit } = req.query;
  const max = limit ? parseInt(limit, 10) : 50;

  const snapshot = await db.ref('products').once('value');
  const raw = snapshot.val() || {};

  let products = Object.keys(raw).map((id) => ({ id, ...raw[id] }));

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  products = products.slice(0, max);

  return res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
}

// ===== POST /api/products =====
async function handlePost(req, res) {
  const body = req.body || {};
  const { name, price, category, data, icon, image, description } = body;

  if (!name || price === undefined || !category || !data) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Cần đủ các trường: name, price, category, data',
    });
  }

  const newProductRef = db.ref('products').push();
  const newProduct = {
    name,
    price: Number(price),
    category,
    icon: icon || '📦',
    image: image || '',
    description: description || '',
    data,
    sold: 0,
    createdAt: Date.now(),
  };

  await newProductRef.set(newProduct);

  return res.status(200).json({
    success: true,
    message: 'Product created successfully',
    productId: newProductRef.key,
    data: { id: newProductRef.key, ...newProduct },
  });
}
