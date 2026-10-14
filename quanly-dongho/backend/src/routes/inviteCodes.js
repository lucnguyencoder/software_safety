/**
 * src/routes/inviteCodes.js
 */
const express = require("express");
const { pool } = require("../db/pool");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function genCode(prefix = "DH") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix + "_";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET — Danh sách mã mời
router.get("/", requireRole("LEADER", "ADMIN"), async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const [rows] = await pool.query(
      isAdmin
        ? "SELECT * FROM tbl_invite_codes ORDER BY createdAt DESC"
        : "SELECT * FROM tbl_invite_codes WHERE clanId = ? ORDER BY createdAt DESC",
      isAdmin ? [] : [req.user.clanId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// POST — Tạo mã mời mới
router.post("/", requireRole("LEADER"), async (req, res) => {
  const { note, expiresAt, usageLimit } = req.body;
  const code = genCode("DH");
  try {
    await pool.query(
      "INSERT INTO tbl_invite_codes (code, createdBy, expiresAt, usageLimit, note, clanId) VALUES (?,?,?,?,?,?)",
      [code, req.user.fullName, expiresAt || null, usageLimit || null, note || null, req.user.clanId]
    );
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "TẠO MÃ MỜI", "InviteCodes", `Tạo mã mời: ${code}${note ? ` — ${note}` : ""}`]
    );
    return res.status(201).json({ code, message: "Tạo mã mời thành công." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT — Vô hiệu hóa mã (tạm khóa)
router.put("/:code/deactivate", requireRole("LEADER", "ADMIN"), async (req, res) => {
  try {
    await pool.query("UPDATE tbl_invite_codes SET isActive=0 WHERE code=?", [req.params.code]);
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "KHÓA MÃ MỜI", "InviteCodes", `Tạm khóa mã: ${req.params.code}`]
    );
    return res.json({ message: "Đã tạm khóa mã mời." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT — Kích hoạt lại mã
router.put("/:code/reactivate", requireRole("LEADER", "ADMIN"), async (req, res) => {
  try {
    await pool.query("UPDATE tbl_invite_codes SET isActive=1 WHERE code=?", [req.params.code]);
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "MỞ MÃ MỜI", "InviteCodes", `Kích hoạt lại mã: ${req.params.code}`]
    );
    return res.json({ message: "Đã kích hoạt lại mã mời." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// DELETE — Xóa vĩnh viễn
router.delete("/:code", requireRole("LEADER", "ADMIN"), async (req, res) => {
  try {
    await pool.query("DELETE FROM tbl_invite_codes WHERE code=? AND clanId=?",
      [req.params.code, req.user.clanId]);
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "XÓA MÃ MỜI", "InviteCodes", `Xóa vĩnh viễn mã: ${req.params.code}`]
    );
    return res.json({ message: "Đã xóa mã mời vĩnh viễn." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;