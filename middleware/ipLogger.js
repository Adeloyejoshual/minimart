// middleware/ipLogger.js
module.exports = function (req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    req.ip;

  req.userIp = ip;
  next();
};