const admin = require('../../lib/firebaseAdmin');
const { applyCors } = require('../../lib/cors');

const db = admin.database();

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'method_not_allowed', message: 'Chỉ hỗ trợ GET' });
  }

  try {
    const { shop_id, token } = req.query;
    if (!shop_id || !token) {
      return res.status(400).json({ success: false, error: 'missing_fields' });
    }
    const snap = await db.ref(`shops/${shop_id}`).once('value');
    const shop = snap.val();
    if (!shop || shop.token !== token) {
      return res.status(401).json({ success: false, error: 'invalid_token' });
    }
    return res.status(200).json({ success: true, shop_id, balance: shop.balance || 0, status: shop.status || 'active' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
};
