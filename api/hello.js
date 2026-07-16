// api/hello.js
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ 
    message: 'API is working!',
    method: req.method,
    timestamp: Date.now()
  });
};
