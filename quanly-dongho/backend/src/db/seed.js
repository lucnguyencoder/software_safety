/**
 * src/db/seed.js
 * Chèn dữ liệu mẫu ban đầu vào database
 * Chạy: node src/db/seed.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const bcrypt = require("bcryptjs");
const { pool } = require("./pool");
const { runSchema } = require("./schema");

async function seed() {
  await runSchema();

  const conn = await pool.getConnection();
  try {
    // Kiểm tra xem đã seed chưa
    const [rows] = await conn.query("SELECT COUNT(*) AS cnt FROM tbl_accounts");
    if (rows[0].cnt > 0) {
      console.log("⚠️  Database already seeded. Skipping.");
      return;
    }

    const hash = (pw) => bcrypt.hashSync(pw, 10);

    // ── Tài khoản ────────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_accounts
        (id,fullName,phone,email,password,role,status,inviteCode,birthDate,gender)
      VALUES
        ('acc_admin',   'Nguyễn Hoàng Nam',   '0901234567','admin.nam@gmail.com',       ?,  'ADMIN',     'ACTIVE','SYSTEM_ROOT',      '1975-03-10','MALE'),
        ('acc_leader',  'Nguyễn Bá Trung',    '0983111222','trungho.nguyenba@gmail.com', ?, 'LEADER',    'ACTIVE','NGUYEN_BA_TRUONG',  '1968-07-22','MALE'),
        ('acc_treasurer','Nguyễn Bá Hoàng',   '0912444555','hoangfinance@gmail.com',     ?, 'TREASURER', 'ACTIVE','QUY_DONG_HO_2026', '1972-11-05','MALE'),
        ('acc_member1', 'Nguyễn Bá Anh Tuấn', '0977888999','tuanba.nguyen@gmail.com',   ?,  'MEMBER',    'ACTIVE','CONCHAU_BUI_GIA',  '1990-04-18','MALE')
    `, [hash("123456"), hash("123456"), hash("123456"), hash("123456")]);

    // ── Thành viên gia phả ───────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_members
        (id,fullName,gender,livingStatus,birthDate,deathDate,deathDateLunar,birthDateLunar,originAddress,generation,representativeRole)
      VALUES
        ('m_gen1_cao','Nguyễn Bá Cao','MALE','DECEASED','1890-04-12','1965-11-03','10/10','15/03','Vụ Bản, Nam Định',1,'Thủy Tổ'),
        ('m_gen1_mai','Lê Thị Mai','FEMALE','DECEASED','1895-08-20','1978-05-02','25/03',NULL,'Vụ Bản, Nam Định',1,'Chính thất Thủy Tổ')
    `);

    // Cập nhật spouseId
    await conn.query(`UPDATE tbl_members SET spouseId='m_gen1_mai' WHERE id='m_gen1_cao'`);
    await conn.query(`UPDATE tbl_members SET spouseId='m_gen1_cao' WHERE id='m_gen1_mai'`);

    await conn.query(`
      INSERT INTO tbl_members
        (id,fullName,gender,livingStatus,birthDate,deathDate,deathDateLunar,originAddress,generation,fatherId,motherId,representativeRole)
      VALUES
        ('m_gen2_thanh','Nguyễn Bá Thanh','MALE','DECEASED','1920-03-15','1990-09-12','15/08','Vụ Bản, Nam Định',2,'m_gen1_cao','m_gen1_mai','Trưởng chi 1'),
        ('m_gen2_duc',  'Nguyễn Bá Đức',  'MALE','DECEASED','1922-07-20','1995-02-18','20/01','Vụ Bản, Nam Định',2,'m_gen1_cao','m_gen1_mai','Trưởng chi 2')
    `);

    await conn.query(`
      INSERT INTO tbl_members
        (id,fullName,gender,livingStatus,birthDate,originAddress,generation,fatherId,phone,job)
      VALUES
        ('m_gen3_trung','Nguyễn Bá Trung','MALE','ALIVE','1968-07-22','Hà Nội',3,'m_gen2_thanh','0983111222','Trưởng tộc'),
        ('m_gen4_hoang','Nguyễn Bá Hoàng','MALE','ALIVE','1972-11-05','Hà Nội',4,'m_gen3_trung','0912444555','Kế toán'),
        ('m_gen4_anhtuan','Nguyễn Bá Anh Tuấn','MALE','ALIVE','1990-04-18','Hà Nội',4,'m_gen3_trung','0977888999','Kỹ sư phần mềm')
    `);

    // Gán mappedMemberId cho các tài khoản
    await conn.query(`UPDATE tbl_accounts SET mappedMemberId='m_gen3_trung' WHERE id='acc_leader'`);
    await conn.query(`UPDATE tbl_accounts SET mappedMemberId='m_gen4_hoang' WHERE id='acc_treasurer'`);
    await conn.query(`UPDATE tbl_accounts SET mappedMemberId='m_gen4_anhtuan' WHERE id='acc_member1'`);

    // ── Định mức niên liễm ───────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_annual_quota (year,amountPerMember,description)
      VALUES (2026, 200000, 'Định mức đóng niên liễm năm 2026 cho toàn thể hội viên')
      ON DUPLICATE KEY UPDATE amountPerMember=VALUES(amountPerMember)
    `);

    // ── Sự kiện ──────────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_events (id,title,type,startDate,startTime,lunarDateLabel,location,description,status,createdBy)
      VALUES
        ('eve_001','Đại Lễ Giỗ Tổ Dòng Họ Nguyễn Bá 2026','DEATH_ANNIVERSARY','2026-04-28','09:00','10/03 Âm lịch','Từ đường họ Nguyễn Bá, Nam Định','Lễ giỗ tổ thường niên, toàn thể tộc viên kính mời về tham dự.','UPCOMING','Nguyễn Bá Trung'),
        ('eve_002','Họp Tộc Đầu Năm 2026','MEETING','2026-02-15','08:30','17/01 Âm lịch','Nhà văn hóa thôn, xã Liên Minh, Nam Định','Họp bàn kế hoạch hoạt động dòng họ năm 2026.','COMPLETED','Nguyễn Bá Trung'),
        ('eve_003','Tảo Mộ Thanh Minh 2026','GRAVE_VISIT','2026-04-05','06:00','08/03 Âm lịch','Nghĩa trang dòng họ, Nam Định','Toàn thể tộc viên cùng nhau tảo mộ, sửa sang phần mộ tổ tiên.','UPCOMING','Nguyễn Bá Trung')
    `);

    // ── Giao dịch quỹ ────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_transactions (id,type,category,amount,date,payerOrReceiver,memberId,description,recordedBy)
      VALUES
        ('tx_001','INCOME','ANNUAL_FEE',200000,'2026-01-20','Nguyễn Bá Anh Tuấn','m_gen4_anhtuan','Đóng niên liễm 2026','Nguyễn Bá Hoàng'),
        ('tx_002','INCOME','ANNUAL_FEE',200000,'2026-01-22','Nguyễn Bá Hoàng','m_gen4_hoang','Đóng niên liễm 2026','Nguyễn Bá Hoàng'),
        ('tx_003','INCOME','VOLUNTARY',1000000,'2026-02-10','Nguyễn Bá Trung','m_gen3_trung','Đóng góp tự nguyện chuẩn bị giỗ tổ','Nguyễn Bá Hoàng'),
        ('tx_004','EXPENSE','EVENT_ORGANIZATION',500000,'2026-02-15',NULL,NULL,'Chi mua lễ vật họp tộc đầu năm','Nguyễn Bá Hoàng'),
        ('tx_005','EXPENSE','TEMPLE_REPAIR',300000,'2026-03-01',NULL,NULL,'Sửa mái ngói từ đường','Nguyễn Bá Hoàng')
    `);

    // ── Audit log ────────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO tbl_audit_logs (actorName,action,module,details)
      VALUES ('Hệ thống','KHỞI TẠO DATABASE','Core','Seed dữ liệu mẫu ban đầu thành công.')
    `);

    console.log("✅ Seed completed successfully!");
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => { console.error("Seed failed:", err); process.exit(1); });
