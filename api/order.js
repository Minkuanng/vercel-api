const admin = require('../lib/firebaseAdmin');
const { applyCors } = require('../lib/cors');

const db = admin.database();

function randomOrderCode() {
  return '#' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed', message: 'Chỉ hỗ trợ POST' });
  }

  try {
    const { token, shop_id, product_id, quantity, input_data } = req.body || {};

    if (!token || !shop_id || !product_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Thiếu token, shop_id hoặc product_id'
      });
    }

    const qty = parseInt(quantity, 10) || 1;
    if (qty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_quantity',
        message: 'quantity phải là số nguyên lớn hơn 0'
      });
    }

    // 1) Kiểm tra đại lý
    const shopSnap = await db.ref(`shops/${shop_id}`).once('value');
    const shop = shopSnap.val();
    if (!shop) {
      return res.status(404).json({ success: false, error: 'shop_not_found', message: 'shop_id không tồn tại' });
    }
    if (shop.status === 'banned') {
      return res.status(403).json({ success: false, error: 'shop_banned', message: 'Đại lý đã bị khóa' });
    }
    if (shop.token !== token) {
      return res.status(401).json({ success: false, error: 'invalid_token', message: 'Token không đúng' });
    }

    // 2) Kiểm tra sản phẩm
    const productSnap = await db.ref(`products/${product_id}`).once('value');
    const product = productSnap.val();
    if (!product) {
      return res.status(404).json({ success: false, error: 'product_not_found', message: 'product_id không tồn tại' });
    }

    const price = Math.round((product.price || 0) * qty);

    // 3) Trừ kho atomic (transaction) - lấy ra `qty` dòng đầu tiên
    let soldLines = null;
    const stockResult = await db.ref(`products/${product_id}/data`).transaction(current => {
      const lines = (current || '').split('\n').filter(l => l.trim() !== '');
      if (lines.length < qty) return; // abort -> không đủ hàng
      soldLines = lines.slice(0, qty);
      return lines.slice(qty).join('\n');
    });

    if (!stockResult.committed) {
      return res.status(409).json({ success: false, error: 'out_of_stock', message: 'Sản phẩm không đủ số lượng trong kho' });
    }

    db.ref(`products/${product_id}/sold`).transaction(c => (c || 0) + qty).catch(() => {});

    // 4) Trừ số dư đại lý atomic (transaction trên cả node shop)
    const balanceResult = await db.ref(`shops/${shop_id}`).transaction(current => {
      if (!current) return current;
      const bal = current.balance || 0;
      if (bal < price) return; // abort -> không đủ tiền
      current.balance = bal - price;
      current.totalOrders = (current.totalOrders || 0) + 1;
      current.totalSpent = (current.totalSpent || 0) + price;
      return current;
    });

    if (!balanceResult.committed) {
      // hoàn lại kho vì đã trừ ở bước 3 nhưng không trừ được tiền
      await db.ref(`products/${product_id}/data`).transaction(current => {
        const lines = (current || '').split('\n').filter(l => l.trim() !== '');
        return soldLines.concat(lines).join('\n');
      });
      db.ref(`products/${product_id}/sold`).transaction(c => Math.max(0, (c || 0) - qty)).catch(() => {});
      return res.status(402).json({ success: false, error: 'insufficient_balance', message: 'Số dư đại lý không đủ' });
    }

    // 5) Ghi lại đơn hàng
    const orderCode = randomOrderCode();
    const orderRef = db.ref('shop_orders').push();
    const orderData = {
      shopId: shop_id,
      productId: product_id,
      productName: product.name || '',
      quantity: qty,
      price,
      inputData: input_data || '',
      orderCode,
      data: soldLines.join('\n'),
      timestamp: Date.now(),
      status: 'success'
    };
    await orderRef.set(orderData);

    return res.status(200).json({
      success: true,
      order_code: orderCode,
      product_id,
      product_name: product.name || '',
      quantity: qty,
      price,
      balance_left: balanceResult.snapshot.val().balance,
      data: soldLines
    });
  } catch (err) {
    console.error('order error:', err);
    return res.status(500).json({ success: false, error: 'server_error', message: 'Lỗi máy chủ, vui lòng thử lại' });
  }
};
