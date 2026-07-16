// ===== FILE: api/order.js =====
// ===== DÀNH CHO VERCEL SERVERLESS FUNCTION =====

// Import các thư viện cần thiết
const admin = require('firebase-admin');

// Khởi tạo Firebase Admin SDK (nếu chưa có)
if (!admin.apps.length) {
    // Lấy thông tin từ biến môi trường trên Vercel
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

// ===== HÀM XỬ LÝ CHÍNH =====
module.exports = async (req, res) => {
    // ===== 1. CORS CONFIGURATION =====
    // Cho phép tất cả domain gọi API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Xử lý preflight request (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    // ==============================

    // ===== 2. CHỈ CHO PHÉP METHOD POST =====
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        // ===== 3. LẤY DỮ LIỆU TỪ REQUEST =====
        const { productId, userId, orderCode } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (!productId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu productId hoặc userId'
            });
        }

        console.log(`📦 Đang xử lý đơn hàng: ${orderCode || 'Không có mã'}`);
        console.log(`🆔 User: ${userId}, Product: ${productId}`);

        // ===== 4. ĐỌC THÔNG TIN SẢN PHẨM =====
        const productRef = db.ref('products/' + productId);
        const snapshot = await productRef.once('value');
        const product = snapshot.val();

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy sản phẩm'
            });
        }

        // ===== 5. KIỂM TRA TỒN KHO =====
        // Lấy danh sách data (mỗi dòng là 1 món)
        const dataArray = product.data 
            ? product.data.split('\n').filter(item => item.trim() !== '') 
            : [];

        console.log(`📊 Tồn kho hiện tại: ${dataArray.length} món`);

        if (dataArray.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Sản phẩm đã hết hàng'
            });
        }

        // ===== 6. LẤY MÓN HÀNG ĐẦU TIÊN =====
        const purchasedItem = dataArray[0];
        const remainingData = dataArray.slice(1).join('\n');

        // ===== 7. CẬP NHẬT TỒN KHO TRONG FIREBASE =====
        await productRef.update({
            data: remainingData,
            sold: (product.sold || 0) + 1
        });

        console.log(`✅ Đã trừ hàng. Còn lại: ${remainingData ? remainingData.split('\n').length : 0} món`);

        // ===== 8. TẠO ĐƠN HÀNG =====
        const orderData = {
            productId: productId,
            productName: product.name || 'Sản phẩm',
            productIcon: product.icon || '📦',
            productImage: product.image || '',
            price: product.price || 0,
            userId: userId,
            userName: 'Khách hàng', // Có thể lấy từ users database
            orderCode: orderCode || 'ORD_' + Date.now().toString(36).toUpperCase(),
            purchasedItem: purchasedItem,
            timestamp: Date.now(),
            status: 'success'
        };

        // Lưu đơn hàng
        const orderRef = db.ref('orders').push();
        await orderRef.set(orderData);

        // ===== 9. TRỪ TIỀN USER (nếu cần) =====
        // Lấy số dư hiện tại
        const userSnapshot = await db.ref('users/' + userId + '/balance').once('value');
        const currentBalance = userSnapshot.val() || 0;
        const newBalance = currentBalance - product.price;

        if (newBalance < 0) {
            // Nếu không đủ tiền, rollback (xóa đơn hàng và hoàn lại hàng)
            await orderRef.remove();
            await productRef.update({ data: product.data }); // Hoàn lại data cũ
            
            return res.status(400).json({
                success: false,
                error: 'Số dư không đủ'
            });
        }

        // Cập nhật số dư mới
        await db.ref('users/' + userId + '/balance').set(newBalance);

        // ===== 10. TẠO THÔNG BÁO =====
        await db.ref('notifications').push({
            message: `✅ ${userId} đã mua ${product.name} thành công!`,
            timestamp: Date.now(),
            readBy: {}
        });

        // ===== 11. TRẢ VỀ KẾT QUẢ =====
        console.log(`🎉 Đơn hàng thành công! Mã: ${orderData.orderCode}`);
        
        return res.status(200).json({
            success: true,
            message: 'Mua hàng thành công!',
            data: {
                orderCode: orderData.orderCode,
                productName: product.name,
                purchasedItem: purchasedItem,
                remainingStock: remainingData ? remainingData.split('\n').length : 0,
                newBalance: newBalance
            }
        });

    } catch (error) {
        // ===== 12. XỬ LÝ LỖI =====
        console.error('❌ Lỗi đặt hàng:', error);
        return res.status(500).json({
            success: false,
            error: 'Lỗi server: ' + error.message
        });
    }
};
