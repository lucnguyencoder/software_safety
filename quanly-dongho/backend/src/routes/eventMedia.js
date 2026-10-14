/**
 * src/routes/eventMedia.js
 * Tư liệu / Hình ảnh đính kèm sự kiện (lưu trữ tài liệu sau sự kiện)
 * GET    /api/events/:eventId/media       — Danh sách tư liệu (mọi tài khoản đã đăng nhập)
 * POST   /api/events/:eventId/media       — Tải lên nhiều tệp (ADMIN, LEADER)
 * DELETE /api/events/:eventId/media/:id   — Xóa 1 tệp (ADMIN, LEADER)
 */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pool } = require("../db/pool");
const { authenticate, requireRole, requireActive } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireActive);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "events");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// S-1: định dạng + dung lượng tệp được phép
const ALLOWED_MIME = {
  "image/jpeg": "IMAGE", "image/png": "IMAGE", "image/webp": "IMAGE", "image/gif": "IMAGE",
  "video/mp4": "VIDEO", "video/webm": "VIDEO", "video/quicktime": "VIDEO", "video/x-matroska": "VIDEO",
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
};
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB / tệp

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 15 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error(`Định dạng tệp "${file.originalname}" không được hỗ trợ.`));
    }
    cb(null, true);
  },
});

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── GET /api/events/:eventId/media ───────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { eventId } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM tbl_event_media WHERE eventId = ? ORDER BY uploadedAt DESC",
      [eventId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("List event media error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/events/:eventId/media — Step 3-7: tải lên nhiều tệp ───────────
router.post("/", requireRole("ADMIN", "LEADER"), (req, res) => {
  upload.array("files", 15)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Tải tệp lên thất bại." });
    }
    const { eventId } = req.params;
    try {
      const [eventRows] = await pool.query("SELECT id FROM tbl_events WHERE id = ?", [eventId]);
      if (!eventRows.length) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(404).json({ error: "Sự kiện không tồn tại." });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Vui lòng chọn ít nhất 1 tệp để tải lên." });
      }

      const created = [];
      for (const file of req.files) {
        const fileType = ALLOWED_MIME[file.mimetype] || "DOCUMENT";
        const id = genId("media");
        const fileUrl = `/uploads/events/${file.filename}`;
        await pool.query(
          `INSERT INTO tbl_event_media (id,eventId,fileName,originalName,fileUrl,fileType,mimeType,fileSize,uploadedBy)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [id, eventId, file.filename, file.originalname, fileUrl, fileType, file.mimetype, file.size, req.user.fullName]
        );
        created.push({
          id, eventId, fileName: file.filename, originalName: file.originalname,
          fileUrl, fileType, mimeType: file.mimetype, fileSize: file.size,
          uploadedBy: req.user.fullName, uploadedAt: new Date().toISOString(),
        });
      }

      await pool.query(
        "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
        [req.user.fullName, "TẢI TƯ LIỆU SỰ KIỆN", "Events", `Tải lên ${created.length} tệp cho sự kiện ${eventId}`]
      );

      return res.status(201).json(created);
    } catch (e) {
      console.error("Upload event media error:", e);
      (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
      return res.status(500).json({ error: "Lỗi server khi lưu tư liệu." });
    }
  });
});

// ── DELETE /api/events/:eventId/media/:mediaId ───────────────────────────────
router.delete("/:mediaId", requireRole("ADMIN", "LEADER"), async (req, res) => {
  try {
    const { eventId, mediaId } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM tbl_event_media WHERE id = ? AND eventId = ?",
      [mediaId, eventId]
    );
    if (!rows.length) return res.status(404).json({ error: "Không tìm thấy tư liệu." });
    const media = rows[0];
    await pool.query("DELETE FROM tbl_event_media WHERE id = ?", [mediaId]);
    fs.unlink(path.join(UPLOAD_DIR, media.fileName), () => {});

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "XÓA TƯ LIỆU SỰ KIỆN", "Events", `Xóa tệp "${media.originalName}" của sự kiện ${eventId}`]
    );

    return res.json({ message: "Đã xóa tư liệu." });
  } catch (err) {
    console.error("Delete event media error:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;