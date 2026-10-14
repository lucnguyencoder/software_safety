/**
 * src/routes/auth.js
 * POST /api/auth/login            — Đăng nhập, trả JWT (BR3: lock sau 5 lần sai)
 * POST /api/auth/register         — Đăng ký tài khoản mới (vai GUEST, chờ duyệt)
 * GET  /api/auth/me               — Lấy thông tin tài khoản hiện tại
 * POST /api/auth/change-password  — Đổi mật khẩu (Flow C + S-1)
 * POST /api/auth/forgot-password  — Gửi yêu cầu cấp lại mật khẩu (Flow D)
 * GET  /api/auth/password-reset-requests — Lấy danh sách yêu cầu (ADMIN)
 * PUT  /api/auth/password-reset-requests/:id/process — Cấp lại mật khẩu (ADMIN)
 * PUT  /api/auth/password-reset-requests/:id/reject  — Từ chối yêu cầu (ADMIN)
 */
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool } = require("../db/pool");
const { authenticate, requireRole, requireActive } = require("../middleware/auth");

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
  const { password, loginAttempts, lockedUntil, ...rest } = acc;
  return rest;
}

/**
 * S-1: Kiểm tra độ mạnh mật khẩu theo BR2
 * - Tối thiểu 8 ký tự
 * - Bao gồm cả chữ và số
 * - Không chứa khoảng trắng
 */
function validatePasswordStrength(password) {
  if (!password || password.length < 8) return "Mật khẩu phải có tối thiểu 8 ký tự.";
  if (!/[a-zA-Z]/.test(password)) return "Mật khẩu phải chứa ít nhất một ký tự chữ.";
  if (!/[0-9]/.test(password)) return "Mật khẩu phải chứa ít nhất một ký tự số.";
  if (/\s/.test(password)) return "Mật khẩu không được chứa khoảng trắng.";
  return null;
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

    // A3a: Không tìm thấy tài khoản — thông báo chung để tránh lộ thông tin
    if (rows.length === 0) {
      return res.status(401).json({ error: "Số điện thoại/Email hoặc mật khẩu không chính xác." });
    }

    const acc = rows[0];

    // A3b: Kiểm tra khóa tạm thời (BR3)
    if (acc.lockedUntil && new Date(acc.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(acc.lockedUntil) - new Date()) / 60000);
      return res.status(403).json({
        error: `Tài khoản bị khóa tạm thời do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${remaining} phút.`
      });
    }

    // A3c: Trạng thái tài khoản không hợp lệ (BR1)
    if (acc.status === "PENDING_ADMIN" || acc.status === "PENDING_LEADER") {
      return res.status(403).json({ error: "Tài khoản của bạn hiện không có quyền truy cập. Đang chờ phê duyệt." });
    }
    if (acc.status === "BLOCKED") {
      return res.status(403).json({ error: `Tài khoản của bạn hiện không có quyền truy cập. ${acc.blockReason ? `Lý do: ${acc.blockReason}` : "Liên hệ quản trị."}` });
    }
    if (acc.status === "REJECTED") {
      return res.status(403).json({ error: "Tài khoản của bạn hiện không có quyền truy cập. Đơn đăng ký đã bị từ chối." });
    }

    // A3a: Kiểm tra mật khẩu
    const match = await bcrypt.compare(password, acc.password);
    if (!match) {
      const newAttempts = (acc.loginAttempts || 0) + 1;

      // A3b: Sau 5 lần sai → khóa tạm thời 15 phút (BR3)
      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        try {
          await pool.query(
            "UPDATE tbl_accounts SET loginAttempts = ?, lockedUntil = ? WHERE id = ?",
            [newAttempts, lockedUntil, acc.id]
          );
        } catch(e) {}
        await pool.query(
          "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
          [acc.fullName, "KHÓA TẠM THỜI", "Auth", `Tài khoản bị khóa 15 phút sau ${newAttempts} lần đăng nhập sai`]
        );
        return res.status(403).json({
          error: "Tài khoản bị khóa tạm thời 15 phút do đăng nhập sai quá nhiều lần."
        });
      }

      try {
        await pool.query(
          "UPDATE tbl_accounts SET loginAttempts = ? WHERE id = ?",
          [newAttempts, acc.id]
        );
      } catch(e) {}
      const remaining = 5 - newAttempts;
      return res.status(401).json({
        error: `Số điện thoại/Email hoặc mật khẩu không chính xác. Còn ${remaining} lần thử trước khi tài khoản bị khóa tạm thời.`
      });
    }

    // Đăng nhập thành công: reset loginAttempts và lockedUntil (BR4: ghi log)
    try {
      await pool.query(
        "UPDATE tbl_accounts SET loginAttempts = 0, lockedUntil = NULL WHERE id = ?",
        [acc.id]
      );
    } catch(e) {}
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [acc.fullName, "ĐĂNG NHẬP", "Auth", `Đăng nhập thành công từ ${req.ip}`]
    );

    return res.json({
      token: makeToken(acc),
      account: stripPassword(acc),
      mustChangePassword: !!acc.mustChangePassword
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { fullName, phone, email, password, birthDate, gender, hometown, address, notes, inviteCode } = req.body;

  if (!fullName || !phone || !email || !password || !inviteCode) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
  }

  // S-1: Validate độ mạnh mật khẩu (BR2)
  const pwError = validatePasswordStrength(password);
  if (pwError) return res.status(400).json({ error: pwError });

  // Kiểm tra mã mời — check cả .env và DB
  const validEnvCodes = (process.env.VALID_INVITE_CODES || "").split(",").map(c => c.trim());
  const isEnvCode = validEnvCodes.includes(inviteCode.trim());

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
    const [dup] = await pool.query(
      "SELECT id FROM tbl_accounts WHERE phone = ? OR email = ? LIMIT 1",
      [phone, email]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: "Số điện thoại hoặc email đã được đăng ký." });
    }

    const id = `acc_${Date.now()}`;
    // S-1: Hash mật khẩu trước khi lưu (BR5)
    const hashed = await bcrypt.hash(password, 10);
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

// ── POST /api/auth/change-password — Flow C ───────────────────────────────────
router.post("/change-password", authenticate, requireActive, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ mật khẩu cũ, mật khẩu mới và xác nhận." });
  }

  // C3a: Validate độ mạnh mật khẩu mới (S-1 + BR2)
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Mật khẩu xác nhận không khớp." });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM tbl_accounts WHERE id = ?", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "Tài khoản không tồn tại." });
    const acc = rows[0];

    // Kiểm tra mật khẩu cũ
    const match = await bcrypt.compare(oldPassword, acc.password);
    if (!match) return res.status(401).json({ error: "Mật khẩu cũ không chính xác." });

    // C3b: Mật khẩu mới không được trùng mật khẩu cũ
    const sameAsOld = await bcrypt.compare(newPassword, acc.password);
    if (sameAsOld) {
      return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    }

    // S-1: Hash mật khẩu mới (BR5)
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE tbl_accounts SET password = ?, mustChangePassword = 0 WHERE id = ?",
      [hashed, req.user.id]
    );

    // BR4: Ghi log
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [acc.fullName, "ĐỔI MẬT KHẨU", "Auth", "Người dùng đổi mật khẩu thành công"]
    );

    return res.json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/auth/change-password-forced — Flow D5 (mật khẩu tạm thời → mật khẩu mới) ──
// Không cần nhập mật khẩu cũ vì user vừa xác thực bằng mật khẩu tạm thời qua đăng nhập
router.post("/change-password-forced", authenticate, requireActive, async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ error: "Vui lòng nhập mật khẩu mới và xác nhận." });
  }

  // Validate độ mạnh mật khẩu mới
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Mật khẩu xác nhận không khớp." });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM tbl_accounts WHERE id = ?", [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: "Tài khoản không tồn tại." });
    const acc = rows[0];

    // Chỉ cho phép dùng route này khi tài khoản đang ở trạng thái bắt buộc đổi mật khẩu
    if (!acc.mustChangePassword) {
      return res.status(403).json({ error: "Tài khoản không ở trạng thái bắt buộc đổi mật khẩu." });
    }

    // Mật khẩu mới không được trùng mật khẩu tạm thời (hiện tại)
    const sameAsOld = await bcrypt.compare(newPassword, acc.password);
    if (sameAsOld) {
      return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu tạm thời vừa được cấp." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE tbl_accounts SET password = ?, mustChangePassword = 0 WHERE id = ?",
      [hashed, req.user.id]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [acc.fullName, "ĐỔI MẬT KHẨU", "Auth", "Người dùng đặt mật khẩu mới sau khi dùng mật khẩu tạm thời"]
    );

    return res.json({ message: "Đặt mật khẩu mới thành công." });
  } catch (err) {
    console.error("Change password forced error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/auth/forgot-password — Flow D ───────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { phoneOrEmail } = req.body;
  if (!phoneOrEmail?.trim()) {
    return res.status(400).json({ error: "Vui lòng cung cấp số điện thoại hoặc email." });
  }

  try {
    // D2a: Kiểm tra tài khoản tồn tại
    const [rows] = await pool.query(
      "SELECT id, fullName, phone, email FROM tbl_accounts WHERE phone = ? OR email = ? LIMIT 1",
      [phoneOrEmail.trim(), phoneOrEmail.trim()]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Số điện thoại hoặc Email này không khớp với bất kỳ tài khoản nào trong hệ thống." });
    }
    const acc = rows[0];

    // D2b: Kiểm tra yêu cầu đang chờ xử lý
    const [existing] = await pool.query(
      "SELECT id FROM tbl_password_reset_requests WHERE accountId = ? AND status = 'PENDING' LIMIT 1",
      [acc.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Bạn đã có một yêu cầu cấp lại mật khẩu đang chờ xử lý. Vui lòng chờ quản trị viên phê duyệt." });
    }

    // S-2: Tạo yêu cầu cấp lại mật khẩu, trạng thái "Chờ xử lý"
    await pool.query(
      "INSERT INTO tbl_password_reset_requests (accountId, fullName, phoneOrEmail, status) VALUES (?, ?, ?, 'PENDING')",
      [acc.id, acc.fullName, phoneOrEmail.trim()]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [acc.fullName, "YÊU CẦU CẤP LẠI MẬT KHẨU", "Auth", `Gửi yêu cầu cấp lại mật khẩu — định danh: ${phoneOrEmail}`]
    );

    return res.json({ message: "Yêu cầu cấp lại mật khẩu đã được gửi đến Quản trị viên. Vui lòng chờ xác minh và liên hệ qua kênh ngoài hệ thống." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/auth/password-reset-requests — S-2: Danh sách yêu cầu ──────────
router.get("/password-reset-requests", authenticate, requireActive, requireRole("ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM tbl_password_reset_requests ORDER BY requestedAt DESC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/auth/password-reset-requests/:id/process — D4: Cấp lại mật khẩu ─
router.put("/password-reset-requests/:id/process", authenticate, requireActive, requireRole("ADMIN"), async (req, res) => {
  try {
    const [reqs] = await pool.query(
      "SELECT * FROM tbl_password_reset_requests WHERE id = ?",
      [req.params.id]
    );
    if (!reqs.length) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
    const resetReq = reqs[0];
    if (resetReq.status !== "PENDING") {
      return res.status(400).json({ error: "Yêu cầu này đã được xử lý rồi." });
    }

    // D5: Sinh mật khẩu tạm thời ngẫu nhiên (tuân theo BR2: ≥8 ký tự, có chữ + số, không khoảng trắng)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    // Đảm bảo có cả chữ lẫn số
    tempPassword = tempPassword.slice(0, 8) + "Abc" + Math.floor(Math.random() * 90 + 10);

    // S-1: Hash mật khẩu tạm thời (BR5)
    const hashed = await bcrypt.hash(tempPassword, 10);

    // Cập nhật mật khẩu + gắn cờ buộc đổi mật khẩu ở lần đăng nhập tiếp
    await pool.query(
      "UPDATE tbl_accounts SET password = ?, mustChangePassword = 1, loginAttempts = 0, lockedUntil = NULL WHERE id = ?",
      [hashed, resetReq.accountId]
    );

    // Cập nhật trạng thái yêu cầu → Đã xử lý
    await pool.query(
      "UPDATE tbl_password_reset_requests SET status = 'PROCESSED', processedBy = ?, processedAt = NOW() WHERE id = ?",
      [req.user.fullName, req.params.id]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "CẤP LẠI MẬT KHẨU", "Auth",
       `Admin cấp mật khẩu tạm thời cho [${resetReq.fullName}] — accountId: ${resetReq.accountId}`]
    );

    // E1: Trả về mật khẩu tạm thời để admin thông báo qua kênh ngoài hệ thống
    return res.json({
      message: "Đã cấp mật khẩu tạm thời thành công. Vui lòng thông báo cho người dùng qua kênh liên hệ ngoài hệ thống.",
      tempPassword,
    });
  } catch (err) {
    console.error("Process reset error:", err);
    return res.status(500).json({ error: "Lỗi xử lý yêu cầu. Vui lòng thử lại sau ít phút." });
  }
});

// ── PUT /api/auth/password-reset-requests/:id/reject — D4a: Từ chối ─────────
router.put("/password-reset-requests/:id/reject", authenticate, requireActive, requireRole("ADMIN"), async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "Vui lòng cung cấp lý do từ chối." });

  try {
    const [reqs] = await pool.query(
      "SELECT * FROM tbl_password_reset_requests WHERE id = ?",
      [req.params.id]
    );
    if (!reqs.length) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
    const resetReq = reqs[0];
    if (resetReq.status !== "PENDING") {
      return res.status(400).json({ error: "Yêu cầu này đã được xử lý rồi." });
    }

    await pool.query(
      "UPDATE tbl_password_reset_requests SET status = 'REJECTED', processedBy = ?, processedAt = NOW(), rejectReason = ? WHERE id = ?",
      [req.user.fullName, reason, req.params.id]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "TỪ CHỐI CẤP LẠI MẬT KHẨU", "Auth",
       `Từ chối yêu cầu của [${resetReq.fullName}] — Lý do: ${reason}`]
    );

    return res.json({ message: "Đã từ chối yêu cầu cấp lại mật khẩu." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;