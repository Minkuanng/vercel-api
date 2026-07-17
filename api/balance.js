const { withCors, getShopByToken } = require('../lib/firebase');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { error, shop, shopId } = await getShopByToken(req);

  if (error) {
    return res.status(401).json({ success: false, error });
  }

  return res.status(200).json({
    success: true,
    data: {
      shopId,
      name: shop.name,
      balance: shop.balance || 0,
      totalOrders: shop.totalOrders || 0,
      totalSpent: shop.totalSpent || 0,
      status: shop.status || 'active',
    },
  });
});
