const admin = require('firebase-admin');

// Khởi tạo Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

module.exports = async (req, res) => {
    // ===== CORS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'method_not_allowed',
            message: 'Chỉ hỗ trợ POST'
        });
    }

    try {
        const { productId, userId, orderCode } = req.body;

        if (!productId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'missing_fields',
                message: 'Thiếu productId hoặc userId'
            });
        }

        // ===== ĐỌC SẢN PHẨM =====
        const productSnapshot = await db.ref('products/' + productId).once('value');
        const product = productSnapshot.val();

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'product_not_found',
                message: 'Không tìm thấy sản phẩm'
            });
        }

        // ===== KIỂM TRA TỒN KHO (QUAN TRỌNG) =====
        const rawData = product.data || '';
        const dataArray = rawData.split('\n').filter(item => item.trim() !== '');

        console.log(`📦 Sản phẩm: ${product.name}`);
        console.log(`📊 Tồn kho: ${dataArray.length} món`);

        if (dataArray.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'out_of_stock',
                message: 'Sản phẩm không đủ số lượng trong kho'
            });
        }

        // ===== LẤY MÓN ĐẦU TIÊN =====
        const purchasedItem = dataArray[0];
        const remainingData = dataArray.slice(1).join('\n');

        // ===== KIỂM TRA SỐ DƯ USER =====
        const userBalance = await db.ref('users/' + userId + '/balance').once('value');
        const currentBalance = userBalance.val() || 0;

        if (currentBalance < product.price) {
            return res.status(400).json({
                success: false,
                error: 'insufficient_balance',
                message: 'Số dư không đủ'
            });
        }

        // ===== CẬP NHẬT DATABASE =====
        // 1. Cập nhật tồn kho sản phẩm
        await db.ref('products/' + productId).update({
            data: remainingData,
            sold: (product.sold || 0) + 1
        });

        // 2. Trừ tiền user
        await db.ref('users/' + userId + '/balance').set(currentBalance - product.price);

        // 3. Tạo đơn hàng
        const orderData = {
            productId,
            productName: product.name || 'Sản phẩm',
            productIcon: product.icon || '📦',
            productImage: product.image || '',
            price: product.price || 0,
            userId,
            userName: 'Khách hàng',
            orderCode: orderCode || 'ORD_' + Date.now().toString(36).toUpperCase(),
            purchasedItem,
            timestamp: Date.now(),
            status: 'success'
        };

        const orderRef = await db.ref('orders').push(orderData);

        // 4. Tạo thông báo
        await db.ref('notifications').push({
            message: `✅ ${userId} đã mua ${product.name}`,
            timestamp: Date.now(),
            readBy: {}
        });

        // ===== TRẢ KẾT QUẢ =====
        return res.status(200).json({
            success: true,
            message: 'Mua hàng thành công!',
            data: {
                orderId: orderRef.key,
                orderCode: orderData.orderCode,
                productName: product.name,
                purchasedItem,
                remainingStock: remainingData ? remainingData.split('\n').length : 0,
                newBalance: currentBalance - product.price
            }
        });

    } catch (error) {
        console.error('❌ Lỗi:', error);
        return res.status(500).json({
            success: false,
            error: 'server_error',
            message: error.message
        });
    }
};
