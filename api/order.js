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

    // 3) LẤY DỮ LIỆU TRƯỚC ĐỂ KIỂM TRA
    // Đọc dữ liệu hiện tại để kiểm tra số lượng
    const currentData = await db.ref(`products/${product_id}/data`).once('value');
    const currentLines = (currentData.val() || '').split('\n').filter(l => l.trim() !== '');
    
    if (currentLines.length < qty) {
      return res.status(409).json({ 
        success: false, 
        error: 'out_of_stock', 
        message: `Sản phẩm không đủ số lượng trong kho (còn ${currentLines.length}, cần ${qty})` 
      });
    }

    // Lấy ra qty dòng đầu tiên
    const soldLines = currentLines.slice(0, qty);
    const remainingLines = currentLines.slice(qty);

    // 4) TRỪ KHO BẰNG CÁCH SET TRỰC TIẾP (KHÔNG DÙNG TRANSACTION)
    try {
      await db.ref(`products/${product_id}/data`).set(remainingLines.join('\n'));
    } catch (err) {
      console.error('Lỗi cập nhật kho:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'stock_update_failed', 
        message: 'Không thể cập nhật kho hàng' 
      });
    }

    // 5) Cập nhật số lượng đã bán (dùng transaction để tránh race condition)
    await db.ref(`products/${product_id}/sold`).transaction(current => {
      return (current || 0) + qty;
    }).catch(() => {});

    // 6) TRỪ SỐ DƯ ĐẠI LÝ (dùng transaction để đảm bảo atomic)
    const balanceResult = await db.ref(`shops/${shop_id}`).transaction(current => {
      if (!current) return current;
      const bal = current.balance || 0;
      if (bal < price) {
        // Không đủ tiền, abort transaction
        return;
      }
      current.balance = bal - price;
      current.totalOrders = (current.totalOrders || 0) + 1;
      current.totalSpent = (current.totalSpent || 0) + price;
      return current;
    });

    // Kiểm tra kết quả transaction
    if (!balanceResult.committed) {
      // TRANSACTION BỊ HỦY - HOÀN LẠI KHO
      console.warn('Transaction số dư thất bại, hoàn lại kho...');
      
      // Hoàn lại kho bằng cách gộp soldLines đã lấy ra với remainingLines
      const refundData = soldLines.concat(remainingLines);
      await db.ref(`products/${product_id}/data`).set(refundData.join('\n'));
      
      // Hoàn lại số lượng đã bán
      await db.ref(`products/${product_id}/sold`).transaction(current => {
        return Math.max(0, (current || 0) - qty);
      }).catch(() => {});

      // Kiểm tra lý do thất bại: do thiếu tiền hay lỗi khác
      if (balanceResult.error === 'MAX_RETRIES') {
        return res.status(402).json({ 
          success: false, 
          error: 'insufficient_balance', 
          message: 'Số dư đại lý không đủ' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'balance_transaction_failed', 
        message: 'Giao dịch số dư thất bại, vui lòng thử lại' 
      });
    }

    // 7) KIỂM TRA LẠI SỐ DƯ SAU TRANSACTION
    const finalShop = balanceResult.snapshot.val();
    if (!finalShop || (finalShop.balance === undefined && finalShop.balance !== 0)) {
      // Nếu số dư không hợp lệ, hoàn lại kho
      console.warn('Số dư không hợp lệ sau transaction, hoàn lại kho...');
      const refundData = soldLines.concat(remainingLines);
      await db.ref(`products/${product_id}/data`).set(refundData.join('\n'));
      await db.ref(`products/${product_id}/sold`).transaction(current => {
        return Math.max(0, (current || 0) - qty);
      }).catch(() => {});
      
      return res.status(500).json({ 
        success: false, 
        error: 'invalid_balance_state', 
        message: 'Trạng thái số dư không hợp lệ' 
      });
    }

    // 8) Ghi lại đơn hàng thành công
    const orderCode = randomOrderCode();
    const orderRef = db.ref('shop_orders').push();
    const orderData = {
      shopId: shop_id,
      shopName: shop.name || 'Đại lý API',
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

    // 9) Trả về kết quả thành công
    return res.status(200).json({
      success: true,
      order_code: orderCode,
      order_id: orderRef.key,
      product_id,
      product_name: product.name || '',
      quantity: qty,
      price,
      balance_left: finalShop.balance || 0,
      data: soldLines
    });

  } catch (err) {
    console.error('order error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'server_error', 
      message: 'Lỗi máy chủ, vui lòng thử lại' 
    });
  }
};
