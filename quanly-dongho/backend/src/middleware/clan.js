/**
 * src/routes/auth.js
 * POST /api/auth/login     — Đăng nhập, trả JWT
 * POST /api/auth/register  — Đăng ký tài khoản mới (vai GUEST, chờ duyệt)
 * GET  /api/auth/me        — Lấy thông tin tài khoản hiện tại
 */
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool } = require("../db/pool");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(account) {
  return jwt.sign(
    { id: account.id, role: account.role, status: account.status, fullName: account.fullName, clanId: account.clanId || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function stripPassword(acc) {
  const { password, ...rest } = acc;
  return rest;
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { phoneOrEmail, password } = req.body;
  if (!phoneOrEmail || !password) {
    return res.status(400).json({ error: "Vui lòng cung cấp số điện thoại/email và mật khẩu." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT *,clanId FROM tbl_accounts WHERE phone = ? OR email = ? LIMIT 1",
      [phoneOrEmail, phoneOrEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Không tìm thấy tài khoản khớp với thông tin đã nhập." });
    }

    const acc = rows[0];

    if (acc.status === "PENDING_ADMIN" || acc.status === "PENDING_LEADER") {
      return res.status(403).json({ error: "Tài khoản đang chờ phê duyệt, chưa thể đăng nhập." });
    }
    if (acc.status === "BLOCKED") {
      return res.status(403).json({ error: `Tài khoản bị khóa: ${acc.blockReason || "Liên hệ quản trị."}` });
    }
    if (acc.status === "REJECTED") {
      return res.status(403).json({ error: "Tài khoản bị từ chối." });
    }

    const match = await bcrypt.compare(password, acc.password);
    if (!match) {
      return res.status(401).json({ error: "Mật khẩu không chính xác." });
    }

    // Ghi audit log
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [acc.fullName, "ĐĂNG NHẬP", "Auth", `Đăng nhập thành công từ ${req.ip}`]
    );

    return res.json({ token: makeToken(acc), account: stripPassword(acc) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { fullName, phone, email, password, birthDate, gender, hometown, address, notes, inviteCode } = req.body;

  // Validate bắt buộc
  if (!fullName || !phone || !email || !password || !inviteCode) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: "Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số." });
  }

  // Kiểm tra mã mời — check cả .env và DB
  const validEnvCodes = (process.env.VALID_INVITE_CODES || "").split(",").map(c => c.trim());
  const isEnvCode = validEnvCodes.includes(inviteCode.trim());

  // Check DB
  let dbCodeRow = null;
  try {
    const [dbRows] = await pool.query(
      "SELECT * FROM tbl_invite_codes WHERE code=? AND isActive=1 AND (expiresAt IS NULL OR expiresAt > NOW()) AND (usageLimit IS NULL OR usedCount < usageLimit) LIMIT 1",
      [inviteCode.trim()]
    );
    dbCodeRow = dbRows.length ? dbRows[0] : null;
  } catch(e) {}

  if (!isEnvCode && !dbCodeRow) {
    return res.status(400).json({ error: "Mã mời không hợp lệ, đã hết hạn hoặc đã đạt giới hạn sử dụng." });
  }

  try {
    // Kiểm tra trùng phone/email
    const [dup] = await pool.query(
      "SELECT id FROM tbl_accounts WHERE phone = ? OR email = ? LIMIT 1",
      [phone, email]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: "Số điện thoại hoặc email đã được đăng ký." });
    }

    const id = `acc_${Date.now()}`;
    const hashed = await bcrypt.hash(password, 10);

    // Lấy clanId từ mã mời DB
    const registerClanId = dbCodeRow ? dbCodeRow.clanId : null;

    await pool.query(
      `INSERT INTO tbl_accounts
        (id,fullName,phone,email,password,birthDate,gender,hometown,address,notes,role,status,inviteCode,clanId)
       VALUES (?,?,?,?,?,?,?,?,?,?,'GUEST','PENDING_ADMIN',?,?)`,
      [id, fullName, phone, email, hashed,
       birthDate || null, gender || "MALE",
       hometown || null, address || null, notes || null,
       inviteCode, registerClanId]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [fullName, "ĐĂNG KÝ TÀI KHOẢN", "Auth", `Khách mới đăng ký với mã mời: ${inviteCode}`]
    );

    // Tăng usedCount nếu là mã DB
    if (dbCodeRow) {
      await pool.query("UPDATE tbl_invite_codes SET usedCount=usedCount+1 WHERE code=?", [inviteCode.trim()]);
    }

    return res.status(201).json({ message: "Đăng ký thành công. Chờ quản trị viên phê duyệt." });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id,fullName,phone,email,birthDate,gender,hometown,address,notes,role,status,inviteCode,mappedMemberId,registeredAt FROM tbl_accounts WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Tài khoản không tồn tại." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;