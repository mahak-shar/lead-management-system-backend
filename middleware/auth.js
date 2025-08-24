const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'No token provided' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ 
      error: 'Invalid token', 
      message: 'Token is invalid or expired' 
    });
  }
};

const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const clearTokenCookie = (res) => {
  res.clearCookie('token');
};

module.exports = {
  authenticateToken,
  generateToken,
  setTokenCookie,
  clearTokenCookie
};
