# BÁO CÁO PHÂN TÍCH QUY TRÌNH KIỂM THỬ AN TOÀN MÃ NGUỒN (WHITEBOX FUZZING)
**Dự án:** Hệ thống Quản lý Dòng họ (Mộc bản)  
**Học phần:** Phân tích Thiết kế Phần mềm / An toàn Phần mềm – Đại học Phenikaa  
**Quy trình thực hiện:** `Source -> Modules -> Log -> Spec -> C Harness -> Excel (CWE)`

---

## 📌 BƯỚC 1: PHÂN TÍCH SOURCE RA MODULES (SOURCE -> MODULES)

Từ mã nguồn gốc của hệ thống (luồng xử lý thành viên gia phả trong `quanly-dongho/backend/src/routes/members.js` kết hợp bảng dữ liệu `tbl_members`), phân tách thành 5 module nghiệp vụ cốt lõi:

1. **`Module_Payload_Parser`**:
   - **Nhiệm vụ:** Tiếp nhận mảng byte nhị phân thô từ Fuzzer/mạng, giải mã và trích xuất các trường thông tin (ID, họ tên, giới tính, trạng thái sinh tử, năm sinh/mất âm dương, thế hệ, ID cha/mẹ/vợ/chồng).
   - **Hàm đại diện:** `parse_member_payload()`, `validate_member_fields()`.

2. **`Module_Member_Registry`**:
   - **Nhiệm vụ:** Khởi tạo, cấp phát bộ nhớ động trên Heap, lưu trữ vào cấu trúc bảng tra cứu và giải phóng các nút thành viên (`MemberNode`).
   - **Hàm đại diện:** `clan_member_create()`, `clan_member_update()`, `clan_member_destroy()`.

3. **`Module_Genealogy_Linker`**:
   - **Nhiệm vụ:** Thiết lập liên kết con trỏ giữa các thành viên (cha - con, mẹ - con, vợ - chồng), kiểm tra tính hợp lệ về huyết thống, phát hiện chu trình lặp phả hệ (Cycle Detection).
   - **Hàm đại diện:** `clan_link_father()`, `clan_link_spouse()`, `detect_circular_ancestry()`.

4. **`Module_Hierarchy_Calculator`**:
   - **Nhiệm vụ:** Tính toán độ sâu thế hệ (`generation depth`), tính chênh lệch tuổi tác/thời gian sống (sinh - mất), đồng bộ lại bậc thế hệ cho toàn bộ nhánh con cháu.
   - **Hàm đại diện:** `calculate_generation_depth()`, `propagate_generation_update()`, `compute_age_lifespan()`.

5. **`Module_Audit_Diff_Logger`**:
   - **Nhiệm vụ:** So sánh trạng thái cấu trúc dữ liệu trước và sau khi chỉnh sửa, nối chuỗi diff chi tiết và ghi nhật ký kiểm toán.
   - **Hàm đại diện:** `generate_member_audit_diff()`, `format_log_entry()`.

---

## 📌 BƯỚC 2: TRÍCH XUẤT MODULES RA LOG (MODULES -> LOG)

Mô phỏng cây thực thi động (Execution Trace), đánh dấu các điểm tương tác dữ liệu, các nhánh rẽ điều kiện (`if/else`) và vòng lặp (`loop`):

```text
[TRACE:ENTRY] parse_member_payload(raw_bytes, size)
├── [CHECK:BOUNDS] Kiểm tra: size >= sizeof(MemberPayloadHeader) ?
│   ├── [FALSE] -> Log("Input too short, drop") -> RETURN ERR_INVALID_LEN
│   └── [TRUE]  -> Log("Payload header valid, unpacking fields...")
├── [CHECK:NAME] Kiểm tra: payload->fullName == NULL || strlen(fullName) == 0 ?
│   ├── [TRUE]  -> Log("Validation failed: BR1 - FullName is mandatory") -> RETURN ERR_EMPTY_NAME
│   └── [FALSE] -> Log("FullName valid: %s", payload->fullName)
├── [CHECK:INTEGER] Kiểm tra: payload->generation <= 0 || payload->generation > MAX_GENERATION
│   ├── [TRUE]  -> Log("Anomaly: Generation value out of sane range [%d]", payload->generation)
│   └── [FALSE] -> Log("Generation valid: %d", payload->generation)
├── [MEM:ALLOC] clan_member_create()
│   ├── malloc(sizeof(MemberNode)) -> Địa chỉ: ptr_node
│   ├── Copy chuỗi fullName (dest_size: 64, src_len: N) -> TIỀM ẨN OOB WRITE
│   ├── Copy chuỗi addresses, dates âm dương -> TIỀM ẨN OOB WRITE
│   └── Khởi tạo con trỏ: father = NULL, mother = NULL, spouse = NULL, child_count = 0
├── [BRANCH:LINK_FATHER] if (payload->fatherId != 0)
│   ├── Tìm kiếm father_node = find_node_by_id(payload->fatherId)
│   ├── if (father_node != NULL)
│   │   ├── [LOOP:CYCLE_DETECT] while (ancestor != NULL)
│   │   │   ├── if (ancestor == ptr_node) -> PHÁT HIỆN VÒNG LẶP HỒI QUY PHẢ HỆ!
│   │   │   └── ancestor = ancestor->father
│   │   └── father_node->children[child_count++] = ptr_node -> TIỀM ẨN ARRAY OOB
│   └── else -> Log("Father ID not found, set orphan")
├── [LOOP:RECURSION] calculate_generation_depth(ptr_node)
│   ├── Đệ quy leo ngược cây phả hệ: depth = 1 + calculate_generation_depth(node->father)
│   └── TIỀM ẨN STACK OVERFLOW nếu chuỗi cha-con bị nối vòng tròn
├── [BRANCH:UPDATE_DIFF] clan_member_update(ptr_node, new_payload)
│   ├── So sánh các trường cũ và mới
│   └── [LOOP:DIFF_STRING] Nối chuỗi sprintf(log_buf, "[%s] đổi từ [%s] sang [%s]") -> TIỀM ẨN FORMAT STRING & HEAP OVERFLOW
└── [MEM:FREE] clan_member_destroy(ptr_node)
    ├── free(ptr_node)
    └── TIỀM ẨN USE-AFTER-FREE: Các nút con trỏ `children` và `spouse` vẫn trỏ vào ptr_node cũ!
```

---

## 📌 BƯỚC 3: ĐÁNH GIÁ LOG RA SPEC (LOG -> SPEC)

Phân tích trọng tâm vào 3 khía cạnh an toàn bộ nhớ và chỉ ra các ranh giới phá vỡ (boundary values):

### 1. Về Buffer (Bộ đệm & Thao tác chuỗi)
- **Kích thước định sẵn:** `fullName` (`char[64]`), `lunar_date` (`char[32]`), `address` (`char[128]`), `audit_buf` (`char[256]`).
- **Nguy cơ lỗi:**
  - **Out-of-bounds Read (CWE-125):** Khi dữ liệu fuzzer không có byte kết thúc chuỗi `\0`, các hàm như `strlen()` hoặc `printf("%s")` sẽ đọc tràn biên, làm lộ dữ liệu trên Stack/Heap.
  - **Out-of-bounds Write / Overflow (CWE-787, CWE-120):** Khi mảng con `father->children[8]` nhận thêm con thứ 9 trở lên, hoặc khi chuỗi mô tả audit diff vượt quá 256 bytes.
- **Ranh giới cần phá vỡ:** Chuỗi 63 bytes không có `\0`, chuỗi vượt 64 bytes, chèn format string `%s%n%x`.

### 2. Về Memory (Con trỏ & Quản lý bộ nhớ động)
- **Vòng đời con trỏ:** Mỗi nút phả hệ chứa các con trỏ liên kết hai chiều (`father`, `spouse`, mảng con trỏ `children[]`).
- **Nguy cơ lỗi:**
  - **Use-After-Free (CWE-416):** Xóa nút cha và `free(father)`, nhưng nút con (`child->father`) vẫn giữ địa chỉ ô nhớ cũ (Dangling Pointer). Khi hàm tính toán leo cây truy cập lại, chương trình crash hoặc bị khai thác UAF.
  - **Uncontrolled Recursion / Stack Exhaustion (CWE-674):** Xuất hiện chu trình huyết thống kín (A -> B -> C -> A) khiến hàm đệ quy tính bậc thế hệ gọi vô tận, cạn kiệt Call Stack dẫn đến Stack Overflow Crash.
  - **Double Free (CWE-415):** Xảy ra khi có xung đột băm (Hash collision) hoặc giải phóng lặp giữa các bucket.
- **Ranh giới cần phá vỡ:** Hoán đổi ID cha-con tạo chu trình vòng tròn; Xóa node cha trước rồi truy cập từ node con.

### 3. Về Integer (Biến số & Tràn số nguyên)
- **Biến `generation` (thế hệ):** Kiểu `int16_t` hoặc `int32_t`.
  - Giá trị biên cực đoan: `-32768`, `-1`, `0`, `32767`.
  - Hậu quả: Dùng `generation` âm làm chỉ số mảng sẽ gây Out-of-bounds Read/Write.
- **Biến `birth_year`, `death_year`:** Kiểu `int16_t`.
  - Tràn số dưới (Integer Underflow - CWE-191): Phép trừ `death_year - birth_year` khi `death_year = -32768` và `birth_year = 32767` sẽ làm tràn số có dấu, vi phạm quy tắc undefined behavior của C.
- **Biến `child_count`:** Kiểu `uint8_t`.
  - Integer Wrap-around: 255 + 1 = 0, cuộn biến đếm về 0 gây ghi đè logic.

---

## 📌 BƯỚC 4: XÂY DỰNG MÃ NGUỒN C MÔ PHỎNG (C FUZZING HARNESS)

Toàn bộ logic trên đã được hiện thực hóa trong file: **`clan_genealogy_fuzzer.c`**.

### Các thành phần kỹ thuật chính trong code:
1. **Struct `FuzzMemberPayload`:** Đóng gói toàn bộ byte đầu vào từ fuzzer thành struct định dạng chuẩn.
2. **Các hàm mục tiêu (Target Functions):**
   - `target_member_create`: Cấp phát nút và copy chuỗi.
   - `target_link_father`: Thiết lập liên kết cha-con, kiểm tra vòng lặp và mảng con.
   - `target_calculate_depth_recursive`: Tính bậc thế hệ bằng đệ quy.
   - `target_audit_diff`: Định dạng chuỗi kiểm toán.
   - `target_member_delete`: Giải phóng nút phả hệ (mô phỏng điểm kích hoạt UAF).
3. **Cổng tiếp nhận Fuzzer:** Hàm `LLVMFuzzerTestOneInput(const uint8_t *data, size_t size)` đóng vai trò là Dispatcher phân phối dữ liệu dựa trên `action_opcode`.
4. **Standalone Runner tích hợp:** Hỗ trợ chạy trực tiếp trên Windows bằng GCC với 50.000 testcase ngẫu nhiên mà không cần cài đặt Clang phức tạp.

---

## 📌 BƯỚC 5: XUẤT BÁO CÁO EXCEL & ĐỊNH DANH CWE

Đã xuất ra 2 file tài liệu:
1. **`Bao_Cao_Kiem_Thu_Fuzzing_MocBan.xlsx`**: File Excel thiết kế chuẩn Dashboard và bảng chi tiết 9 cột.
2. **`Bao_Cao_Kiem_Thu_Fuzzing_MocBan.csv`**: File CSV chuẩn UTF-8.

### Bảng tóm tắt 10 lỗ hổng định danh:

| STT | Module | Tên hàm | Vùng dữ liệu liên quan | Loại rủi ro | Mã CWE / CVE | Mức độ | Mô tả phạm vi lỗi | Chiến lược tạo dữ liệu Fuzz |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **1** | `Module_Member_Registry` | `target_member_create` | `full_name, lunar_date, address` | buffer | **CWE-120 / CWE-125** | High | Sao chép chuỗi không null-terminated (`\0`), đọc tràn biên bộ nhớ khi dùng `strlen` / `printf`. | Sinh buffer 64 bytes không chứa byte `0x00`. |
| **2** | `Module_Genealogy_Linker` | `target_link_father` | `father->children[MAX_CHILDREN]` | buffer | **CWE-787 / CWE-122** | Critical | Ghi vượt ngoài giới hạn mảng (Heap OOB Write) khi một cha có hơn 8 con. | Gửi chuỗi lệnh `opcode=2` với cùng `father_id` và hơn 8 `child_id` khác nhau. |
| **3** | `Module_Hierarchy_Calculator` | `target_calculate_depth_recursive` | `node->father pointer chain` | memory | **CWE-674 / CWE-400** | High | Đệ quy không kiểm soát gây cạn kiệt Call Stack (Stack Overflow) do chu trình lặp kín. | Tạo liên kết vòng lặp khép kín: 1 -> 2 -> 3 -> 1, gọi hàm tính bậc thế hệ. |
| **4** | `Module_Member_Registry` | `target_member_delete` | `g_clan_table & pointer links` | memory | **CWE-416** | Critical | Sử dụng vùng nhớ sau giải phóng (Use-After-Free): Xóa cha nhưng con vẫn giữ con trỏ trỏ về cha. | Tạo node A, B -> Link A là cha B -> Xóa A -> Truy cập lại từ B lên A. |
| **5** | `Module_Audit_Diff_Logger` | `target_audit_diff` | `audit_buf[256]` | buffer | **CWE-134 / CWE-120** | High | Tràn bộ đệm stack hoặc lỗi Format String khi chuỗi diff vượt quá 256 bytes hoặc chứa format specifier. | Gửi chuỗi họ tên chứa `%n%p%s` và tạo chuỗi diff cực đại (> 512 bytes). |
| **6** | `Module_Hierarchy_Calculator` | `compute_age_lifespan` | `birth_year, death_year` | integer | **CWE-191 / CWE-190** | Medium | Tràn số nguyên dưới khi `death_year = -32768` và `birth_year = 32767`. | Giá trị biên: `birth_year = 32767`, `death_year = -32768`. |
| **7** | `Module_Payload_Parser` | `parse_member_payload` | `generation, action_opcode` | integer | **CWE-190 / CWE-1284** | Medium | Sai lệch dấu/tràn số ở biến thế hệ (`generation <= 0` hoặc `> 30000`). | Kiểm thử giá trị biên: `generation = -32768, -1, 0, 32767`. |
| **8** | `Module_Member_Registry` | `clean_all / clan_member_destroy` | `g_clan_table nodes` | memory | **CWE-415** | High | Giải phóng vùng nhớ kép (Double Free) do xung đột hàm băm (Hash Collision). | Sinh nhiều `member_id` có cùng `id % 64` (id=1 và id=65) xen kẽ tạo và xóa. |
| **9** | `Module_Payload_Parser` | `validate_member_fields` | `raw_data_size (size_t)` | integer | **CWE-131 / CWE-125** | Medium | Xử lý sai kích thước dữ liệu khi `size < sizeof(Header)` hoặc gần `SIZE_MAX`. | Cung cấp `size = 0, 1, sizeof(Header) - 1, 0xFFFFFFFF`. |
| **10** | `Module_Genealogy_Linker` | `clan_link_spouse` | `node->spouse pointer` | memory | **CWE-476 / CWE-401** | Medium | Giải tham chiếu con trỏ NULL hoặc rò rỉ bộ nhớ khi gán đè liên kết phối ngẫu nhiều lần. | Gửi `spouse_id = 0` kết hợp opcode cập nhật liên kết phối ngẫu nhiều lần. |
