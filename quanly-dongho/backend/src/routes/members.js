/**
 * src/routes/members.js
 * GET    /api/members         — Danh sách toàn bộ tộc viên (phân trang + tìm kiếm)
 * GET    /api/members/:id     — Chi tiết một tộc viên
 * POST   /api/members         — Thêm tộc viên mới (LEADER)
 * PUT    /api/members/:id     — Sửa thông tin (LEADER)
 * DELETE /api/members/:id     — Xóa khỏi gia phả (LEADER)
 */
const express = require("express");
const { pool } = require("../db/pool");
const { authenticate, requireRole, requireActive } = require("../middleware/auth");

const router = express.Router();

// Tất cả route đều cần đăng nhập và tài khoản ACTIVE
router.use(authenticate, requireActive);

// ── GET /api/members ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search, gender, livingStatus, generation, page = 1, limit = 100 } = req.query;
    const clanId = req.user.clanId;
    let where = ["clanId = ?"];
    let params = [clanId];

    if (search) {
      where.push("(fullName LIKE ? OR phone LIKE ? OR email LIKE ?)");
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (gender && gender !== "ALL") { where.push("gender = ?"); params.push(gender); }
    if (livingStatus && livingStatus !== "ALL") { where.push("livingStatus = ?"); params.push(livingStatus); }
    if (generation) { where.push("generation = ?"); params.push(generation); }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await pool.query(
      `SELECT * FROM tbl_members ${whereClause} ORDER BY generation ASC, fullName ASC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tbl_members ${whereClause}`,
      params
    );

    return res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/members/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tbl_members WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Không tìm thấy thành viên." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/members ─────────────────────────────────────────────────────────
router.post("/", requireRole("ADMIN", "LEADER"), async (req, res) => {
  const {
    fullName, gender, livingStatus, birthDate, birthDateLunar,
    deathDate, deathDateLunar, phone, email,
    currentAddress, originAddress, generation,
    fatherId, motherId, spouseId, job, representativeRole, notes
  } = req.body;

  if (!fullName || !gender || !generation) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc: fullName, gender, generation." });
  }

  try {
    const id = `m_new_${Date.now()}`;
    const clanId = req.user.clanId;
    await pool.query(
      `INSERT INTO tbl_members
        (id,fullName,gender,livingStatus,birthDate,birthDateLunar,deathDate,deathDateLunar,
         phone,email,currentAddress,originAddress,generation,fatherId,motherId,spouseId,
         job,representativeRole,notes,clanId)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, fullName, gender, livingStatus || "ALIVE",
       birthDate || null, birthDateLunar || null,
       deathDate || null, deathDateLunar || null,
       phone || null, email || null,
       currentAddress || null, originAddress || null,
       generation, fatherId || null, motherId || null, spouseId || null,
       job || null, representativeRole || null, notes || null, clanId]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "THÊM THÀNH VIÊN GIA PHẢ", "GiaPha",
       `Thêm tộc viên [${fullName}] vào đời thứ ${generation}`]
    );

    const [rows] = await pool.query("SELECT * FROM tbl_members WHERE id = ?", [id]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/members/:id ──────────────────────────────────────────────────────
// BR1: Chỉ tài khoản mang quyền Trưởng họ mới có quyền sửa thông tin/cấu trúc Node.
router.put("/:id", requireRole("LEADER"), async (req, res) => {
  const fields = [
    "fullName","gender","livingStatus","birthDate","birthDateLunar",
    "deathDate","deathDateLunar","phone","email","currentAddress",
    "originAddress","generation","fatherId","motherId","spouseId",
    "job","representativeRole","notes"
  ];

  // BR4: lấy trạng thái TRƯỚC khi sửa để ghi nhật ký so sánh trước/sau
  const [beforeRows] = await pool.query("SELECT * FROM tbl_members WHERE id = ?", [req.params.id]);
  if (!beforeRows.length) return res.status(404).json({ error: "Không tìm thấy thành viên." });
  const before = beforeRows[0];

  const updates = [];
  const params = [];
  const fieldLabels = {
    fullName: "Họ và tên", gender: "Giới tính", livingStatus: "Trạng thái",
    birthDate: "Ngày sinh", birthDateLunar: "Ngày sinh Âm lịch",
    deathDate: "Ngày mất", deathDateLunar: "Ngày mất Âm lịch",
    phone: "SĐT", email: "Email", currentAddress: "Địa chỉ hiện tại",
    originAddress: "Quê quán", generation: "Đời", fatherId: "Cha liên kết",
    motherId: "Mẹ liên kết", spouseId: "Vợ/Chồng liên kết",
    job: "Nghề nghiệp", representativeRole: "Chức vị", notes: "Ghi chú",
  };
  const changes = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      const newVal = req.body[f] === "" ? null : req.body[f];
      updates.push(`${f} = ?`);
      params.push(newVal);
      const oldVal = before[f];
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        changes.push(`[${fieldLabels[f] || f}] từ [${oldVal ?? "trống"}] thành [${newVal ?? "trống"}]`);
      }
    }
  }
  if (!updates.length) return res.status(400).json({ error: "Không có dữ liệu cập nhật." });

  try {
    params.push(req.params.id);
    await pool.query(`UPDATE tbl_members SET ${updates.join(",")} WHERE id = ?`, params);

    // BR4: Nhật ký lưu rõ trạng thái trước/sau của từng trường đã thay đổi
    const details = changes.length
      ? `Sửa thành viên [${before.fullName}]: ${changes.join("; ")}`
      : `Cập nhật thành viên [${before.fullName}] (không thay đổi dữ liệu)`;
    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "CẬP NHẬT THÀNH VIÊN", "GiaPha", details]
    );

    const [rows] = await pool.query("SELECT * FROM tbl_members WHERE id = ?", [req.params.id]);
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /api/members/:id ───────────────────────────────────────────────────
router.delete("/:id", requireRole("ADMIN", "LEADER"), async (req, res) => {
  try {
    const { reason, notes } = req.body || {};
    const [rows] = await pool.query("SELECT fullName FROM tbl_members WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Không tìm thấy." });

    // Gỡ liên kết tài khoản trước
    await pool.query("UPDATE tbl_accounts SET mappedMemberId = NULL WHERE mappedMemberId = ?", [req.params.id]);
    await pool.query("DELETE FROM tbl_members WHERE id = ?", [req.params.id]);

    const detailParts = [`Đã xóa tộc viên [${rows[0].fullName}] (id=${req.params.id})`];
    if (reason) detailParts.push(`Lý do: ${reason}`);
    if (notes) detailParts.push(`Ghi chú: ${notes}`);

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "XÓA THÀNH VIÊN GIA PHẢ", "GiaPha", detailParts.join(". ")]
    );

    return res.json({ message: "Đã xóa thành công." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;