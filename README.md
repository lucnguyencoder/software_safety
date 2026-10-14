# Software Safety & Whitebox Fuzzing Project

Dự án kiểm thử an toàn phần mềm (Software Safety) và Whitebox Fuzzing cho **Hệ thống Quản lý Dòng họ**.

---

## 📁 Cấu trúc kho lưu trữ (Repository Structure)

```text
├── clan_genealogy_fuzzer.c              # Mã nguồn C mô phỏng & Fuzzing Harness (libFuzzer/AFL/GCC)
├── BAO_CAO_QUY_TRINH_FUZZING.md         # Báo cáo chi tiết quy trình 5 bước (Source -> Modules -> Log -> Spec -> Excel)
├── Bao_Cao_Kiem_Thu_Fuzzing_MocBan.xlsx # Bảng báo cáo đánh giá rủi ro MITRE CWE (định dạng Excel)
├── Bao_Cao_Kiem_Thu_Fuzzing_MocBan.csv  # Bảng báo cáo định danh CWE (định dạng CSV)
├── quanly-dongho/                       # Mã nguồn hệ thống Quản lý Dòng họ
│   ├── src/                             # Frontend (React 19, TypeScript, Vite, Tailwind CSS)
│   ├── backend/                         # Backend API (Node.js, Express, MySQL)
│   │   └── src/                         # REST API routes, middleware, db schema
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                           # Cấu hình bỏ qua node_modules, .env, *.exe
└── README.md
```

---

## 🚀 Hướng dẫn biên dịch và chạy Fuzzer (`clan_genealogy_fuzzer.c`)

### 1. Chạy trực tiếp trên Windows (sử dụng GCC)
```powershell
# Biên dịch
gcc clan_genealogy_fuzzer.c -o fuzzer_clan.exe

# Chạy 50.000 lượt kiểm thử tự động
.\fuzzer_clan.exe
```

### 2. Chạy nâng cao với Clang libFuzzer + AddressSanitizer (Linux/WSL)
```bash
# Biên dịch cùng Sanitizers
clang -fsanitize=fuzzer,address,undefined -DLIBFUZZER_RUN -g -O1 clan_genealogy_fuzzer.c -o fuzzer_clan

# Khởi chạy kiểm thử
mkdir -p corpus
./fuzzer_clan corpus/ -max_len=512 -runs=10000000
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