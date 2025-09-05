const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  try {
    let token;
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      const err = new Error('Authentication required');
      err.status = 401;
      throw err;
    }

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const decoded = jwt.verify(token, secret);
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      err.status = 401;
      err.message = 'Invalid or expired token';
    }
    next(err);
  }
}

module.exports = { auth };
