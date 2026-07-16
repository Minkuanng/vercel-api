const { db, withCors, getShopByToken } = require('../lib/firebase');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { error, shop, shopId } = await getShopByToken(req);
  if (error) {
    return res.status(401).json({ success: false, error });
  }

  const { productId, quantity } = req.body || {};
  const qty = Number(quantity) > 0 ? Number(quantity) : 1;

  if (!productId) {
    return res.status(400).json({ success: false, error: 'productId is required' });
  }

  const productRef = db.ref('products/' + productId);
  const productSnap = await productRef.once('value');
  const product = productSnap.val();

  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const lines = (product.data || '').split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < qty) {
    return res.status(400).json({ success: false, error: 'Sản phẩm không đủ hàng trong kho' });
  }

  const totalPrice = product.price * qty;
  const currentBalance = shop.balance || 0;

  if (currentBalance < totalPrice) {
    return res.status(400).json({ success: false, error: 'Số dư không đủ để đặt hàng' });
  }

  // Lấy `qty` dòng đầu tiên giao cho khách, phần còn lại giữ lại trong kho
  const itemsToDeliver = lines.slice(0, qty);
  const remainingLines = lines.slice(qty);

  await productRef.update({
    data: remainingLines.join('\n'),
    sold: (product.sold || 0) + qty,
  });

  await db.ref('shops/' + shopId).update({
    balance: currentBalance - totalPrice,
    totalOrders: (shop.totalOrders || 0) + 1,
    totalSpent: (shop.totalSpent || 0) + totalPrice,
  });

  const orderCode = 'OD' + Date.now().toString(36).toUpperCase();
  const orderRef = db.ref('orders').push();
  const order = {
    shopId,
    userName: shop.name,
    productId,
    productName: product.name,
    productImage: product.image || '',
    productIcon: product.icon || '📦',
    price: totalPrice,
    quantity: qty,
    orderCode,
    status: 'success',
    timestamp: Date.now(),
  };
  await orderRef.set(order);

  return res.status(200).json({
    success: true,
    message: 'Order placed successfully',
    data: {
      orderId: orderRef.key,
      orderCode,
      items: itemsToDeliver,
      totalPrice,
      remainingBalance: currentBalance - totalPrice,
    },
  });
});
