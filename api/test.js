module.exports = (req, res) => {
  res.status(200).json({ status: 'serverless-active', time: new Date().toISOString(), method: req.method });
};
