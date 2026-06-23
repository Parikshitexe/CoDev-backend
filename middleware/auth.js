import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  // First, check if token is in cookies (the new method)
  let token = req.cookies?.token;

  // Fallback to Authorization header if cookies aren't set (for backwards compatibility during transition or API clients)
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

export default authMiddleware;
