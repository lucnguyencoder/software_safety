/**
 * src/routes/events.js
 * GET    /api/events             — Danh sách sự kiện (lọc theo tháng/năm/loại)
 * POST   /api/events             — Tạo sự kiện (LEADER)
 * PUT    /api/events/:id         — Cập nhật (LEADER)
 * DELETE /api/events/:id         — Xóa (LEADER)
 * POST   /api/events/:id/rsvp    — Xác nhận tham dự (MEMBER+)
 * POST   /api/events/auto-gioc   — Tự động tạo lịch giỗ (LEADER)
 */
const express = require("express");
const { pool } = require("../db/pool");
const { authenticate, requireRole, requireActive } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireActive);

// ── GET /api/events ───────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { year, month, type, status } = req.query;
    const clanId = req.user.clanId;
    let where = ["clanId = ?"];
    let params = [clanId];

    if (year)   { where.push("YEAR(startDate) = ?");  params.push(year); }
    if (month)  { where.push("MONTH(startDate) = ?"); params.push(month); }
    if (type)   { where.push("type = ?");             params.push(type); }
    if (status) { where.push("status = ?");           params.push(status); }

    const wc = where.length ? "WHERE " + where.join(" AND ") : "";
    const [events] = await pool.query(
      `SELECT * FROM tbl_events ${wc} ORDER BY startDate ASC`,
      params
    );

    // Lấy RSVPs cho từng event
    const eventIds = events.map(e => e.id);
    let rsvpMap = {};
    if (eventIds.length > 0) {
      const [rsvps] = await pool.query(
        `SELECT * FROM tbl_event_rsvps WHERE eventId IN (?)`,
        [eventIds]
      );
      rsvps.forEach(r => {
        if (!rsvpMap[r.eventId]) rsvpMap[r.eventId] = [];
        rsvpMap[r.eventId].push(r);
      });
    }

    const result = events.map(e => ({ ...e, rsvps: rsvpMap[e.id] || [] }));
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────────
router.post("/", requireRole("ADMIN", "LEADER"), async (req, res) => {
  const { title, type, startDate, startTime, endDate, lunarDateLabel,
          location, description, status, deceasedMemberId } = req.body;

  if (!title || !startDate || !location) {
    return res.status(400).json({ error: "Thiếu: title, startDate, location." });
  }

  try {
    const id = `eve_${Date.now()}`;
    const evClanId = req.user.clanId;
    await pool.query(
      `INSERT INTO tbl_events
        (id,title,type,startDate,startTime,endDate,lunarDateLabel,location,description,status,deceasedMemberId,createdBy,clanId)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, title, type || "OTHER",
       startDate, startTime || null, endDate || null,
       lunarDateLabel || null, location, description || null,
       status || "UPCOMING", deceasedMemberId || null,
       req.user.fullName, evClanId]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "LÊN LỊCH SỰ KIỆN", "Events",
       `Tạo sự kiện [${title}] ngày ${startDate}`]
    );

    const [rows] = await pool.query("SELECT * FROM tbl_events WHERE id = ?", [id]);
    return res.status(201).json({ ...rows[0], rsvps: [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/events/:id ───────────────────────────────────────────────────────
router.put("/:id", requireRole("ADMIN", "LEADER"), async (req, res) => {
  const allowed = ["title","type","startDate","startTime","endDate",
                   "lunarDateLabel","location","description","status",
                   "cancelReason","postponeReason"];
  const updates = [];
  const params = [];
  for (const f of allowed) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: "Không có dữ liệu cập nhật." });

  try {
    params.push(req.params.id);
    await pool.query(`UPDATE tbl_events SET ${updates.join(",")} WHERE id = ?`, params);

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "CẬP NHẬT SỰ KIỆN", "Events",
       `Sửa sự kiện id=${req.params.id}, status=${req.body.status || "?"}`]
    );

    const [rows] = await pool.query("SELECT * FROM tbl_events WHERE id = ?", [req.params.id]);
    const [rsvps] = await pool.query("SELECT * FROM tbl_event_rsvps WHERE eventId = ?", [req.params.id]);
    return res.json({ ...rows[0], rsvps });
  } catch (err) {
    console.error("PUT /api/events/:id lỗi:", err);
    // Trả về thông tin lỗi thật (sqlMessage nếu có) để dễ chẩn đoán — đây là dự án demo/nội bộ.
    return res.status(500).json({
      error: `Lỗi server khi cập nhật sự kiện: ${err.sqlMessage || err.message || "Không rõ nguyên nhân"}`,
      code: err.code || null
    });
  }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
router.delete("/:id", requireRole("ADMIN", "LEADER"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT title FROM tbl_events WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Không tìm thấy." });

    await pool.query("DELETE FROM tbl_events WHERE id = ?", [req.params.id]);

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "XÓA SỰ KIỆN", "Events",
       `Xóa sự kiện [${rows[0].title}]`]
    );

    return res.json({ message: "Đã xóa." });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/events/:id/rsvp ─────────────────────────────────────────────────
router.post("/:id/rsvp", async (req, res) => {
  const { status, additionalGuests = 0, reason } = req.body;
  if (!["ATTENDING","ABSENT","UNDECIDED"].includes(status)) {
    return res.status(400).json({ error: "status phải là ATTENDING | ABSENT | UNDECIDED." });
  }

  try {
    await pool.query(
      `INSERT INTO tbl_event_rsvps (eventId,accountId,fullName,status,additionalGuests,reason)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), additionalGuests=VALUES(additionalGuests), reason=VALUES(reason)`,
      [req.params.id, req.user.id, req.user.fullName, status, additionalGuests, reason || null]
    );
    return res.json({ message: "Đã cập nhật RSVP." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/events/auto-gioc ────────────────────────────────────────────────
router.post("/auto-gioc", requireRole("ADMIN", "LEADER"), async (req, res) => {
  try {
    const [deceased] = await pool.query(
      "SELECT * FROM tbl_members WHERE livingStatus = 'DECEASED' AND deathDateLunar IS NOT NULL"
    );

    const [existing] = await pool.query(
      "SELECT deceasedMemberId FROM tbl_events WHERE type = 'DEATH_ANNIVERSARY' AND deceasedMemberId IS NOT NULL"
    );
    const existingIds = new Set(existing.map(r => r.deceasedMemberId));

    let count = 0;
    for (const m of deceased) {
      if (existingIds.has(m.id)) continue;

      const [day, month] = (m.deathDateLunar || "1/1").split("/").map(Number);
      // Ước lượng dương lịch (không chính xác 100% nhưng đủ dùng cho demo)
      const approxDate = new Date(2026, month - 1, day);
      const dateStr = approxDate.toISOString().split("T")[0];

      const id = `eve_auto_${m.id}_${Date.now()}`;
      await pool.query(
        `INSERT INTO tbl_events (id,title,type,startDate,startTime,lunarDateLabel,location,description,status,isAutoGenerated,deceasedMemberId,createdBy)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, `Lễ Giỗ: ${m.fullName}`, "DEATH_ANNIVERSARY",
         dateStr, "09:00", `${m.deathDateLunar} Âm lịch`,
         "Từ đường họ Nguyễn Bá, Nam Định",
         `Lễ kỵ giỗ cố ${m.fullName}`, "UPCOMING", 1, m.id,
         "Hệ thống tự động"]
      );
      count++;
    }

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "TỰ ĐỘNG TẠO LỊCH GIỖ", "Events",
       `Tạo mới ${count} lịch giỗ tự động cho năm 2026`]
    );

    return res.json({ message: `Đã tạo ${count} lịch giỗ.`, created: count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;