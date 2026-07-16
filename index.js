// index.js - Root directory
module.exports = (req, res) => {
  res.status(200).json({
    message: 'API is running!',
    endpoints: {
      'GET /api/hello': 'Test endpoint',
      'GET /api/products': 'Get all products',
      'POST /api/products': 'Create new product',
      'GET /api/product/:id': 'Get single product',
      'POST /api/products/batch': 'Batch import products'
    }
  });
};
