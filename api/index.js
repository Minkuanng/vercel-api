module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Root /api đang hoạt động — nếu bạn thấy JSON này, deployment OK.',
    routes: ['/api/hello', '/api/products', '/api/product/:id', '/api/products/batch', '/api/balance', '/api/order'],
  });
};
