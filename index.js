// index.js
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  res.status(200).json({
    message: 'API is running!',
    endpoints: {
      'GET /api/hello': 'Test endpoint',
      'GET /api/products': 'Get all products',
      'POST /api/products': 'Create new product',
      'GET /api/product/:id': 'Get single product'
    }
  });
};
