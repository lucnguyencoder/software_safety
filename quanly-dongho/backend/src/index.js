/**
 * src/index.js — Entry point cho Backend API
 * Quản lý Dòng họ — Node.js + Express + MySQL
 */
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const path       = require("path");
const rateLimit  = require("express-rate-limit");
const { testConnection } = require("./db/pool");
const { runSchema }      = require("./db/schema");

const authRouter     = require("./routes/auth");
const membersRouter  = require("./routes/members");
const eventsRouter   = require("./routes/events");
const eventMediaRouter = require("./routes/eventMedia");
const clanInfoRouter = require("./routes/clanInfo");
const financeRouter  = require("./routes/finance");
const accountsRouter = require("./routes/accounts");
const inviteCodesRouter = require("./routes/inviteCodes");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS: chỉ cho phép frontend đã cấu hình
app.use(cors({
  origin: [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:3000"],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: giới hạn 100 req/15 phút mỗi IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
});
app.use(limiter);

// Rate limit chặt hơn cho route đăng nhập (10 lần/15 phút)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Quá nhiều lần đăng nhập thất bại. Thử lại sau 15 phút." },
});
app.use("/api/auth/login", loginLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
// Phục vụ tệp tư liệu sự kiện (ảnh/video/tài liệu) đã tải lên dưới dạng tĩnh
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth",         authRouter);
app.use("/api/members",      membersRouter);
app.use("/api/events",       eventsRouter);
app.use("/api/events/:eventId/media", eventMediaRouter);
app.use("/api/clan-info", clanInfoRouter);
app.use("/api/finance",      financeRouter);
app.use("/api/accounts",     accountsRouter);
app.use("/api/invite-codes", inviteCodesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), service: "Quản lý Dòng họ API" });
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Endpoint không tồn tại." }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Lỗi server nội bộ." });
});

// ── Khởi động ────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  await runSchema();               // Tạo bảng nếu chưa có
  app.listen(PORT, () => {
    console.log(`🚀 API server running at http://localhost:${PORT}`);
    console.log(`   Frontend expected at: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

start().catch(err => {
  console.error("Server failed to start:", err);
  process.exit(1);
});