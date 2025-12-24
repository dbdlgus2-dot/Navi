// node-api/middlewares/adminOnly.js
module.exports = function adminOnly(req, res, next) {

    console.log("ADMIN REQ cookies:", req.headers.cookie);
  console.log("ADMIN REQ session:", req.session);

  
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  if (user.role !== "ADMIN") {
    return res.status(403).json({ message: "관리자만 접근 가능합니다." });
  }

  next();
};