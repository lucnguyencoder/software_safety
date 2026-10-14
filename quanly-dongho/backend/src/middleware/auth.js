const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập. Vui lòng cung cấp token." });
  }
  const token = auth.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
    }
    next();
  };
}

function requireActive(req, res, next) {
  if (req.user?.status !== "ACTIVE") {
    return res.status(403).json({ error: "Tài khoản chưa được kích hoạt." });
  }
  next();
}

module.exports = { authenticate, requireRole, requireActive };