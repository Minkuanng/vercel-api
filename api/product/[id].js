const admin = require('../../lib/firebaseAdmin');
const { applyCors } = require('../../lib/cors');

const db = admin.database();

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'method_not_allowed', message: 'Chỉ hỗ trợ GET' });
  }

  try {
    const { id } = req.query;
    const snap = await db.ref(`products/${id}`).once('value');
    const p = snap.val();
    if (!p) return res.status(404).json({ success: false, error: 'product_not_found' });
    const stock = (p.data || '').split('\n').filter(l => l.trim() !== '').length;
    return res.status(200).json({ success: true, product_id: id, name: p.name || '', price: p.price || 0, stock });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
};
