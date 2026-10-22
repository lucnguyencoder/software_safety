# Software Safety & White-box Fuzzing Project

Dự án kiểm thử an toàn phần mềm (Software Safety) và **White-box State-Space & Path-Coverage Fuzzing** cho **Hệ thống Quản lý Dòng họ (`quanly-dongho`)**.

---

## 📁 Cấu trúc kho lưu trữ (Repository Structure)

```text
├── clan_genealogy_fuzzer.c              # Mã nguồn C White-box Fuzzer (1 Module: Module_Clan_Genealogy_Engine)
├── Bao_Cao_Kiem_Thu_Fuzzing_MocBan.xlsx # Báo cáo kết quả kiểm thử (16 States, 16 Predicates, 10 Paths, Log)
├── quanly-dongho/                       # Mã nguồn hệ thống Quản lý Dòng họ (Mộc Bản)
│   ├── src/                             # Frontend (React 19, TypeScript, Vite, Tailwind CSS)
│   ├── backend/                         # Backend API (Node.js, Express, MySQL)
│   │   └── src/                         # REST API routes, middleware, db schema
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                           # Cấu hình bỏ qua node_modules, .env, *.exe, *.log
└── README.md
```

---

## 🔍 Kiến trúc Kiểm thử White-box Fuzzing

1. **Module mục tiêu duy nhất (`Module_Clan_Genealogy_Engine`)**:
   - **Step 1 (`Parser`)**: Kiểm tra bộ đệm tên thành viên (`name_buf[16]`) và chuỗi định dạng tiểu sử (`bio_buf[64]`).
   - **Step 2 (`Heap Alloc`)**: Quản lý cấp phát động nút thành viên (`malloc(64B)`) và vòng đời con trỏ (`Dangling Pointer`, `Use-After-Free`, `Double Free`).
   - **Step 3 (`Linker`)**: Liên kết chỉ mục Cha-Con trên bảng tĩnh (`g_member_table[16]`) và tham chiếu con trỏ Phối ngẫu (`spouse_ptr`).
   - **Step 4 (`DFS/BFS & Fund`)**: Duyệt cây gia phả theo chiều sâu (`DFS`) & chiều rộng (`BFS`) phát hiện chu trình lặp vô hạn (`0 <-> 1`), kết hợp cấp phát bộ nhớ Quỹ dòng họ (`16-bit Integer Overflow`).
   - **Step 5 (`Audit Diff`)**: Đối chiếu lịch sử chỉnh sửa trên bộ đệm Stack (`old_bio_buf[24]`).

2. **Độ phủ & Kết quả phát hiện lỗi**:
   - **State Coverage**: `100.0% (16 / 16 States: S00 .. S15)`
   - **Predicate Coverage**: `100.0% (16 / 16 Predicates: P00 .. P15)`
   - **Path Coverage**: `100.0% (10 / 10 Execution Paths: PATH_01 .. PATH_10)`
   - **Phát hiện bất thường**: **8 Crashes** (`CWE-121`, `CWE-134`, `CWE-416`, `CWE-415`, `CWE-787`, `CWE-476`, `CWE-190`, `CWE-125`) và **1 Hang** (`CWE-674`).

3. **Cấu trúc file báo cáo `Bao_Cao_Kiem_Thu_Fuzzing_MocBan.xlsx`**:
   - **Sheet 1 (`1_States_Predicates_Memory`)**: Cây quan hệ 16 trạng thái, biểu thức mệnh đề và cấp phát vùng nhớ.
   - **Sheet 2 (`2_Path_Coverage_10_Paths`)**: Đặc tả độ phủ 10 đường đi thực thi (`PATH_01` .. `PATH_10`).
   - **Sheet 3 (`3_WhiteBox_Fuzzing_DFS_BFS`)**: Chi tiết 11 Test Cases qua 3 giai đoạn (`Seed Init`, `BFS Queue`, `DFS Stack`).
   - **Sheet 4 (`4_Execution_Log`)**: Nhật ký thực thi chi tiết toàn chiến dịch.

---

## 🚀 Hướng dẫn biên dịch và chạy Fuzzer (`clan_genealogy_fuzzer.c`)

```powershell
# Biên dịch với GCC
gcc -Wall -Wextra clan_genealogy_fuzzer.c -o fuzzer_clan.exe

# Thực thi chiến dịch White-box Fuzzing (Seed -> BFS -> DFS)
.\fuzzer_clan.exe
```

---

## 🛠 Hướng dẫn chạy ứng dụng Quản lý Dòng họ (`quanly-dongho`)

### Backend
```bash
cd quanly-dongho/backend
npm install
npm run seed
npm run dev
```

### Frontend
```bash
cd quanly-dongho
npm install
npm run dev
```
