const { withCors } = require('../lib/firebase');

module.exports = withCors(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API đang hoạt động ✅',
    time: new Date().toISOString(),
  });
});
