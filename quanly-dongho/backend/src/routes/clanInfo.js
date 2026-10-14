/**
 * src/routes/clanInfo.js
 * UC: Quản lý Thông tin Dòng họ
 * BR1: Chỉ LEADER được chỉnh sửa
 * BR2: Các trường bắt buộc (trừ currentResidenceArea)
 * BR3: Lưu thành công → hiệu lực toàn hệ thống ngay lập tức
 */
const express = require("express");
const router  = express.Router();
const { pool } = require("../db/pool");
const { authenticate, requireActive } = require("../middleware/auth");

// Middleware dùng chung cho mọi route
const auth = [authenticate, requireActive];

// ── Đảm bảo bảng tồn tại (chạy 1 lần khi import) ───────────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tbl_clan_info (
        id                   INT          AUTO_INCREMENT PRIMARY KEY,
        clanId               VARCHAR(50)  NOT NULL UNIQUE,
        clanName             VARCHAR(150) NOT NULL,
        originHistory        TEXT         NOT NULL,
        homeTown             VARCHAR(255) NOT NULL,
        currentResidenceArea VARCHAR(255) DEFAULT NULL,
        templeAddress        VARCHAR(255) NOT NULL,
        ancestorDayLunar     VARCHAR(50)  NOT NULL,
        clanRegulations      TEXT         NOT NULL,
        updatedAt            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updatedBy            VARCHAR(100) NOT NULL DEFAULT 'Hệ thống'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tbl_clan_info_history (
        id         INT          AUTO_INCREMENT PRIMARY KEY,
        clanId     VARCHAR(50)  NOT NULL,
        actorId    VARCHAR(50)  NOT NULL,
        actorName  VARCHAR(100) NOT NULL,
        changeNote TEXT         NOT NULL,
        createdAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clan_history (clanId, createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    conn.release();
  } catch (err) {
    console.error("[clanInfo] Không thể tạo bảng:", err.message);
  }
})();

// ── GET /api/clan-info ───────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const clanId = req.user.clanId;
    const [rows] = await pool.query(
      "SELECT * FROM tbl_clan_info WHERE clanId = ? LIMIT 1",
      [clanId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error("[GET /clan-info]", err);
    res.status(500).json({ error: "Hệ thống bận, không thể tải thông tin dòng họ lúc này." });
  }
});

// ── GET /api/clan-info/history ───────────────────────────────────────────────
router.get("/history", auth, async (req, res) => {
  try {
    const clanId = req.user.clanId;
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const [rows] = await pool.query(
      `SELECT id, actorName, changeNote, createdAt
       FROM tbl_clan_info_history
       WHERE clanId = ?
       ORDER BY createdAt DESC
       LIMIT ?`,
      [clanId, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("[GET /clan-info/history]", err);
    res.status(500).json({ error: "Không thể tải lịch sử." });
  }
});

// ── PUT /api/clan-info ───────────────────────────────────────────────────────
router.put("/", auth, async (req, res) => {
  // BR1: Chỉ LEADER được chỉnh sửa
  if (req.user.role !== "LEADER") {
    return res.status(403).json({ error: "Chỉ Trưởng họ mới được chỉnh sửa thông tin dòng họ." });
  }

  const { clanName, originHistory, homeTown, currentResidenceArea,
          templeAddress, ancestorDayLunar, clanRegulations } = req.body;

  // BR2 / S-1: Kiểm tra trường bắt buộc
  const required = { clanName, originHistory, homeTown, templeAddress, ancestorDayLunar, clanRegulations };
  const labels   = {
    clanName:        "Tên dòng họ",
    originHistory:   "Nguồn gốc / Lịch sử dòng họ",
    homeTown:        "Quê quán gốc",
    templeAddress:   "Địa chỉ Từ đường",
    ancestorDayLunar:"Ngày Giỗ tổ",
    clanRegulations: "Tộc ước / Quy chế dòng họ",
  };
  for (const [field, val] of Object.entries(required)) {
    if (!val || !String(val).trim()) {
      return res.status(400).json({ error: `Trường "${labels[field]}" không được để trống.` });
    }
  }

  // S-1: Validate định dạng ngày Âm lịch (d/m hoặc dd/mm)
  if (!/^\d{1,2}\/\d{1,2}$/.test(String(ancestorDayLunar).trim())) {
    return res.status(400).json({
      error: "Ngày Giỗ tổ không đúng định dạng. Vui lòng nhập Ngày/Tháng Âm lịch, ví dụ: 10/03.",
    });
  }

  const clanId = req.user.clanId;
  const conn   = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lấy dữ liệu cũ để tính diff
    const [old] = await conn.query(
      "SELECT * FROM tbl_clan_info WHERE clanId = ? LIMIT 1",
      [clanId]
    );

    // Upsert (BR3: hiệu lực ngay)
    await conn.query(
      `INSERT INTO tbl_clan_info
         (clanId, clanName, originHistory, homeTown, currentResidenceArea,
          templeAddress, ancestorDayLunar, clanRegulations, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         clanName             = VALUES(clanName),
         originHistory        = VALUES(originHistory),
         homeTown             = VALUES(homeTown),
         currentResidenceArea = VALUES(currentResidenceArea),
         templeAddress        = VALUES(templeAddress),
         ancestorDayLunar     = VALUES(ancestorDayLunar),
         clanRegulations      = VALUES(clanRegulations),
         updatedBy            = VALUES(updatedBy),
         updatedAt            = CURRENT_TIMESTAMP`,
      [
        clanId,
        String(clanName).trim(),
        String(originHistory).trim(),
        String(homeTown).trim(),
        currentResidenceArea ? String(currentResidenceArea).trim() : null,
        String(templeAddress).trim(),
        String(ancestorDayLunar).trim(),
        String(clanRegulations).trim(),
        req.user.fullName,
      ]
    );

    // Ghi lịch sử thay đổi
    const oldData = old[0] || {};
    const fieldLabels = {
      clanName: "Tên dòng họ", originHistory: "Nguồn gốc/Lịch sử",
      homeTown: "Quê quán gốc", currentResidenceArea: "Địa bàn cư trú",
      templeAddress: "Địa chỉ Từ đường", ancestorDayLunar: "Ngày Giỗ tổ",
      clanRegulations: "Tộc ước/Quy chế",
    };
    const changes = [];
    for (const [key, label] of Object.entries(fieldLabels)) {
      const nv = req.body[key] ? String(req.body[key]).trim() : "";
      const ov = oldData[key]  ? String(oldData[key]).trim()  : "";
      if (nv !== ov) {
        changes.push(`${label}: "${ov.substring(0,40)}${ov.length>40?"...":""}" → "${nv.substring(0,40)}${nv.length>40?"...":""}"`);
      }
    }
    const changeNote = changes.length
      ? changes.join(" | ")
      : old[0] ? "Lưu không đổi nội dung" : "Khởi tạo lần đầu";

    await conn.query(
      `INSERT INTO tbl_clan_info_history (clanId, actorId, actorName, changeNote)
       VALUES (?, ?, ?, ?)`,
      [clanId, req.user.id, req.user.fullName, changeNote]
    );

    // Audit log (không có cột clanId trong tbl_audit_logs)
    await conn.query(
      `INSERT INTO tbl_audit_logs (actorName, action, module, details)
       VALUES (?, 'UPDATE_CLAN_INFO', 'Thông tin dòng họ', ?)`,
      [req.user.fullName, changeNote]
    );

    await conn.commit();

    const [updated] = await conn.query(
      "SELECT * FROM tbl_clan_info WHERE clanId = ? LIMIT 1",
      [clanId]
    );
    res.json({ message: "Cập nhật thông tin dòng họ thành công!", data: updated[0] });
  } catch (err) {
    await conn.rollback();
    console.error("[PUT /clan-info]", err);
    // E1: rollback + báo lỗi
    res.status(500).json({
      error: "Hệ thống bận, không thể lưu thông tin dòng họ lúc này. Vui lòng thử lại sau.",
    });
  } finally {
    conn.release();
  }
});

module.exports = router;