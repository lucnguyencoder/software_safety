/**
 * src/routes/finance.js
 * GET  /api/finance/transactions        — Danh sách giao dịch (tất cả ACTIVE user xem)
 * POST /api/finance/transactions        — Ghi giao dịch mới (TREASURER, LEADER)
 * GET  /api/finance/quota               — Lấy định mức niên liễm năm hiện tại
 * PUT  /api/finance/quota               — Cập nhật định mức (LEADER)
 * GET  /api/finance/summary             — Tổng thu, tổng chi, số dư
 */
const express = require("express");
const { pool } = require("../db/pool");
const { authenticate, requireRole, requireActive } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireActive);

// ── GET /api/finance/transactions ─────────────────────────────────────────────
router.get("/transactions", async (req, res) => {
  try {
    const { type, category, year, page = 1, limit = 50 } = req.query;
    const clanId = req.user.clanId;
    let where = ["t.clanId = ?"];
    let params = [clanId];

    if (type)     { where.push("t.type = ?");          params.push(type); }
    if (category) { where.push("t.category = ?");      params.push(category); }
    if (year)     { where.push("YEAR(t.date) = ?");    params.push(year); }

    const wc = where.length ? "WHERE " + where.join(" AND ") : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await pool.query(
      `SELECT t.*, m.fullName AS memberName
       FROM tbl_transactions t
       LEFT JOIN tbl_members m ON t.memberId = m.id
       ${wc}
       ORDER BY t.date DESC, t.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tbl_transactions t ${wc}`, params
    );

    return res.json({ data: rows, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/finance/transactions ────────────────────────────────────────────
router.post("/transactions", requireRole("TREASURER"), async (req, res) => {
  const { type, category, amount, date, payerOrReceiver, memberId, description } = req.body;

  if (!type || !amount || !date || !payerOrReceiver || !description) {
    return res.status(400).json({ error: "Thiếu: type, amount, date, payerOrReceiver, description." });
  }
  if (!["INCOME","EXPENSE"].includes(type)) {
    return res.status(400).json({ error: "type phải là INCOME hoặc EXPENSE." });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: "Số tiền phải lớn hơn 0." });
  }

  try {
    const id = `tx_${Date.now()}`;
    const txClanId = req.user.clanId;
    await pool.query(
      `INSERT INTO tbl_transactions
        (id,type,category,amount,date,payerOrReceiver,memberId,description,recordedBy,clanId)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, type, category || "OTHER", amount, date,
       payerOrReceiver, memberId || null, description,
       req.user.fullName, txClanId]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName,
       type === "INCOME" ? "GHI NHẬN PHIẾU THU" : "GHI NHẬN PHIẾU CHI",
       "Finance",
       `${type === "INCOME" ? "Thu" : "Chi"} ${Number(amount).toLocaleString()}đ — ${description}`]
    );

    const [rows] = await pool.query("SELECT * FROM tbl_transactions WHERE id = ?", [id]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/finance/quota ────────────────────────────────────────────────────
router.get("/quota", async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const clanId = req.user.clanId || "default";
    const [rows] = await pool.query(
      "SELECT * FROM tbl_annual_quota WHERE year = ? AND clanId = ?", [year, clanId]
    );
    if (!rows.length) {
      return res.json({ year: parseInt(year), amountPerMember: 200000, description: "Chưa thiết lập", clanId });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/finance/quotas — Danh sách tất cả định mức theo năm ──────────────
router.get("/quotas", async (req, res) => {
  try {
    const clanId = req.user.clanId || "default";
    const [rows] = await pool.query(
      "SELECT * FROM tbl_annual_quota WHERE clanId = ? ORDER BY year DESC", [clanId]
    );
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/finance/quota ────────────────────────────────────────────────────
router.put("/quota", requireRole("TREASURER"), async (req, res) => {
  const { year, amountPerMember, description, notes } = req.body;
  if (!year || !amountPerMember) {
    return res.status(400).json({ error: "Thiếu: year, amountPerMember." });
  }
  if (amountPerMember <= 0) {
    return res.status(400).json({ error: "Định mức phải lớn hơn 0." });
  }
  const currentYear = new Date().getFullYear();
  if (parseInt(year) < 2000 || parseInt(year) > currentYear + 10) {
    return res.status(400).json({ error: `Năm áp dụng phải từ 2000 đến ${currentYear + 10}.` });
  }

  try {
    const clanId = req.user.clanId || "default";
    await pool.query(
      `INSERT INTO tbl_annual_quota (year, clanId, amountPerMember, description, notes)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         amountPerMember=VALUES(amountPerMember),
         description=VALUES(description),
         notes=VALUES(notes),
         updatedAt=CURRENT_TIMESTAMP`,
      [year, clanId, amountPerMember, description || null, notes || null]
    );

    await pool.query(
      "INSERT INTO tbl_audit_logs (actorName,action,module,details) VALUES (?,?,?,?)",
      [req.user.fullName, "CẬP NHẬT ĐỊNH MỨC NIÊN LIỄM", "Finance",
       `Định mức năm ${year}: ${Number(amountPerMember).toLocaleString()}đ/người — ${description || ""}`.trim()]
    );

    const [rows] = await pool.query(
      "SELECT * FROM tbl_annual_quota WHERE year = ? AND clanId = ?", [year, clanId]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/finance/summary ──────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const [[{ totalIncome }]] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS totalIncome FROM tbl_transactions WHERE type='INCOME' AND YEAR(date)=?",
      [year]
    );
    const [[{ totalExpense }]] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS totalExpense FROM tbl_transactions WHERE type='EXPENSE' AND YEAR(date)=?",
      [year]
    );
    const [[{ allTimeBalance }]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE -amount END),0) AS allTimeBalance
       FROM tbl_transactions`
    );

    // Thống kê theo category
    const [byCategory] = await pool.query(
      `SELECT type, category, SUM(amount) AS total
       FROM tbl_transactions WHERE YEAR(date) = ?
       GROUP BY type, category`,
      [year]
    );

    return res.json({
      year: parseInt(year),
      totalIncome: Number(totalIncome),
      totalExpense: Number(totalExpense),
      balance: Number(totalIncome) - Number(totalExpense),
      allTimeBalance: Number(allTimeBalance),
      byCategory
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;