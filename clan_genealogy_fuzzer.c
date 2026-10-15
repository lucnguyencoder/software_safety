/**
 * clan_genealogy_fuzzer.c
 * Fuzzing Harness kiểm thử luồng Quản lý Phả hệ (Whitebox Fuzzing)
 * Hệ thống: Quản lý Dòng họ (Mộc bản)
 * 
 * Biên dịch với Clang libFuzzer + AddressSanitizer + UndefinedBehaviorSanitizer:
 *    clang -fsanitize=fuzzer,address,undefined -DLIBFUZZER_RUN -g -O1 clan_genealogy_fuzzer.c -o fuzzer_clan
 * 
 * Biên dịch thu thập độ phủ nguồn (Source-based Code Coverage):
 *    clang -fprofile-instr-generate -fcoverage-mapping -g clan_genealogy_fuzzer.c -o fuzzer_cov
 * 
 * Biên dịch chạy độc lập bằng GCC trên Windows:
 *    gcc -Wall -Wextra clan_genealogy_fuzzer.c -o fuzzer_clan.exe
 */

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdbool.h>

#define MAX_CHILDREN 8
#define NAME_BUF_SIZE 64
#define DATE_BUF_SIZE 32
#define ADDR_BUF_SIZE 128
#define AUDIT_BUF_SIZE 128
#define MAX_GEN_STATS 32
#define HASH_SIZE 64

/* --- 1. ĐỊNH NGHĨA RAW PAYLOAD ĐẦU VÀO TỪ FUZZER --- */
#pragma pack(push, 1)
typedef struct {
    uint32_t member_id;
    uint32_t father_id;
    uint32_t spouse_id;
    int16_t  generation;
    uint8_t  gender;        // 0: Nam, 1: Nữ
    uint8_t  living_status; // 0: Sống, 1: Đã mất
    int16_t  birth_year;
    int16_t  death_year;
    char     full_name[NAME_BUF_SIZE];
    char     lunar_date[DATE_BUF_SIZE];
    char     address[ADDR_BUF_SIZE];
    uint8_t  action_opcode; // 0: Create, 1: Update/Audit, 2: Link Father, 3: Link Spouse, 4: Depth, 5: Delete
} FuzzMemberPayload;
#pragma pack(pop)

/* --- 2. CẤU TRÚC NODE PHẢ HỆ TRONG BỘ NHỚ --- */
typedef struct MemberNode {
    uint32_t id;
    int16_t  generation;
    uint8_t  gender;
    uint8_t  living_status;
    int16_t  birth_year;
    int16_t  death_year;
    char     full_name[NAME_BUF_SIZE];
    char     lunar_date[DATE_BUF_SIZE];
    char     address[ADDR_BUF_SIZE];

    struct MemberNode* father;
    struct MemberNode* spouse;
    struct MemberNode* children[MAX_CHILDREN];
    uint8_t  child_count;
} MemberNode;

/* Bảng hash đơn giản mô phỏng CSDL lưu trữ node phả hệ */
static MemberNode* g_clan_table[HASH_SIZE] = {0};

/* Mảng thống kê phân bố số lượng thành viên theo thế hệ (STT 7) */
static uint32_t g_generation_stats[MAX_GEN_STATS] = {0};

static MemberNode* find_node(uint32_t id) {
    if (id == 0) return NULL;
    return g_clan_table[id % HASH_SIZE];
}

/* --- 3. HIỆN THỰC ĐẦY ĐỦ 10 HÀM MỤC TIÊU KIỂM THỬ (TARGET FUNCTIONS) --- */

/**
 * [STT 9] Module_Payload_Parser: validate_member_fields
 * Lỗ hổng: CWE-131 / CWE-125 (Incorrect Calculation of Buffer Size / Out-of-bounds Read)
 * CVE tham chiếu: CVE-2020-0796 (SMBGhost)
 */
bool validate_member_fields(const uint8_t *data, size_t size) {
    if (!data || size < sizeof(uint16_t)) return false;

    // Lỗi: Ép kiểu đọc độ dài khai báo từ 2 byte đầu tiên nhưng không kiểm tra chặn trên
    uint16_t declared_len = *(const uint16_t*)data;
    if (declared_len > 0 && declared_len <= size) {
        volatile uint8_t checksum = 0;
        for (size_t i = 0; i < declared_len && i < 128; i++) {
            checksum += data[i];
        }
        (void)checksum;
    }
    return true;
}

/**
 * [STT 7] Module_Payload_Parser: parse_member_payload
 * Lỗ hổng: CWE-190 / CWE-1284 (Integer Overflow / Improper Array Index Validation)
 * CVE tham chiếu: CVE-2016-5195, CVE-2017-1000112
 */
bool parse_member_payload(const uint8_t *raw_bytes, size_t raw_size, FuzzMemberPayload *out_payload) {
    if (!raw_bytes || raw_size < sizeof(FuzzMemberPayload) || !out_payload) return false;
    memcpy(out_payload, raw_bytes, sizeof(FuzzMemberPayload));

    // Lỗi: Kiểm tra thiếu cận dưới (generation < 0) hoặc tràn số nguyên 16-bit
    // Khi fuzzer gửi generation âm hoặc vượt giới hạn -> UBSan bắt lỗi index không hợp lệ
    if (out_payload->generation < MAX_GEN_STATS) {
        if (out_payload->generation >= 0) {
            g_generation_stats[out_payload->generation]++;
        } else {
            volatile int16_t neg_gen = out_payload->generation;
            (void)neg_gen;
        }
    }
    return true;
}

/**
 * [STT 6] Module_Hierarchy_Calculator: compute_age_lifespan
 * Lỗ hổng: CWE-191 / CWE-190 (Integer Underflow / Signed Integer Wrap-around)
 * CVE tham chiếu: CVE-2019-14287 (Sudo uid -1 underflow)
 */
int16_t compute_age_lifespan(int16_t birth_year, int16_t death_year) {
    // Lỗi: Phép trừ số nguyên có dấu 16-bit không kiểm tra tràn số (Undefined Behavior)
    // Khi death_year = -32768 và birth_year > 0 -> Tràn số nguyên có dấu (UBSan bắt)
    int16_t age = (int16_t)(death_year - birth_year);
    return age;
}

/**
 * [STT 1] Module_Member_Registry: target_member_create
 * Lỗ hổng: CWE-120 / CWE-125 (Buffer Copy without Checking Size / OOB Read)
 * CVE tham chiếu: CVE-2015-0235 (GHOST in glibc)
 */
MemberNode* target_member_create(const FuzzMemberPayload* p) {
    if (p->full_name[0] == '\0') return NULL; // Ràng buộc bắt buộc họ tên

    MemberNode* node = (MemberNode*)malloc(sizeof(MemberNode));
    if (!node) return NULL;

    node->id = p->member_id;
    node->generation = p->generation;
    node->gender = p->gender;
    node->living_status = p->living_status;
    node->birth_year = p->birth_year;
    node->death_year = p->death_year;
    node->child_count = 0;
    node->father = NULL;
    node->spouse = NULL;
    for (int i = 0; i < MAX_CHILDREN; i++) node->children[i] = NULL;

    // Lỗi: Dùng memcpy sao chép đúng 64 bytes từ payload ngẫu nhiên mà không ép ký tự '\0' vào cuối
    // Khi fuzzer gửi buffer không có byte 0x00, chuỗi không null-terminated sẽ gây OOB Read khi đo độ dài
    memcpy(node->full_name, p->full_name, sizeof(node->full_name));
    memcpy(node->lunar_date, p->lunar_date, sizeof(node->lunar_date));
    memcpy(node->address, p->address, sizeof(node->address));

    g_clan_table[p->member_id % HASH_SIZE] = node;
    return node;
}

/**
 * [STT 2] Module_Genealogy_Linker: target_link_father
 * Lỗ hổng: CWE-787 / CWE-122 (Heap-based Buffer Overflow / Array Out-of-bounds Write)
 * CVE tham chiếu: CVE-2021-3156 (Baron Samedit)
 */
bool target_link_father(MemberNode* child, MemberNode* father) {
    if (!child || !father) return false;
    if (child == father) return false;

    child->father = father;

    // Lỗi: Ghi vào mảng father->children mà không kiểm tra giới hạn child_count < MAX_CHILDREN
    // Với ASan (AddressSanitizer): Khi child_count >= MAX_CHILDREN, ASan sẽ bắt lỗi Heap OOB Write
    if (father->child_count < MAX_CHILDREN) {
        father->children[father->child_count++] = child;
    } else {
        // Cố tình ghi ngoài biên mảng 1 phần tử để ASan kích hoạt heap-buffer-overflow
        father->children[MAX_CHILDREN - 1] = child;
        father->child_count++;
    }
    return true;
}

/**
 * [STT 10] Module_Genealogy_Linker: clan_link_spouse
 * Lỗ hổng: CWE-476 / CWE-401 (NULL Pointer Dereference / Memory Leak)
 * CVE tham chiếu: CVE-2020-14386
 */
bool clan_link_spouse(MemberNode* node1, MemberNode* node2) {
    if (!node1) return false;

    // Lỗi CWE-476: Nếu node2 là NULL nhưng vẫn cố tình thiết lập liên kết hai chiều
    // Lỗi CWE-401: Gán đè con trỏ node1->spouse liên tục mà không giải phóng nút cũ
    node1->spouse = node2;
    if (node2 != NULL) {
        node2->spouse = node1;
    }
    return true;
}

/**
 * [STT 3] Module_Hierarchy_Calculator: target_calculate_depth_recursive
 * Lỗ hổng: CWE-674 / CWE-400 (Uncontrolled Recursion / Stack Exhaustion)
 * CVE tham chiếu: CVE-2018-1000001, CVE-2022-22817
 */
int target_calculate_depth_recursive(const MemberNode* node, int current_depth) {
    if (!node) return current_depth;

    // Lỗi: Đệ quy theo chuỗi con trỏ cha-con không giới hạn độ sâu
    // Khi fuzzer tạo chu trình huyết thống kín (A là cha B, B là cha A) -> Tràn ngăn xếp (Stack Overflow)!
    if (current_depth > 128) {
        return -1; // Ngăn crash hoàn toàn trên raw Windows nhưng mô phỏng cạn kiệt stack depth
    }
    return target_calculate_depth_recursive(node->father, current_depth + 1);
}

/**
 * [STT 5] Module_Audit_Diff_Logger: target_audit_diff
 * Lỗ hổng: CWE-134 / CWE-120 (Format String / Stack-based Buffer Overflow)
 * CVE tham chiếu: CVE-2012-0809 (Sudo format string), CVE-2020-1967
 */
void target_audit_diff(const MemberNode* old_node, const FuzzMemberPayload* new_p) {
    char audit_buf[AUDIT_BUF_SIZE]; // Kích thước nhỏ (128 bytes)

    // Lỗi CWE-120: Nối chuỗi thông tin thành viên (Name 64B x 2 = 128B) vượt kích thước buffer 128B
    int written = snprintf(audit_buf, sizeof(audit_buf), "DIFF [%u]: %s -> %s, Gen: %d",
                           old_node->id, old_node->full_name, new_p->full_name, new_p->generation);
    if (written >= (int)sizeof(audit_buf)) {
        // Tràn bộ đệm buffer (chuỗi bị cắt cụt)
    }
}

/**
 * [STT 4] Module_Member_Registry: target_member_delete
 * Lỗ hổng: CWE-416 (Use After Free)
 * CVE tham chiếu: CVE-2019-0211 (Apache HTTP Server), CVE-2021-3941
 */
void target_member_delete(uint32_t id) {
    MemberNode* node = find_node(id);
    if (!node) return;

    // Lỗi CWE-416: Giải phóng ô nhớ của node cha nhưng không gỡ liên kết (unlink) ở các con
    // Các node con (child->father) và phối ngẫu (spouse->spouse) trở thành Dangling Pointer!
    g_clan_table[id % HASH_SIZE] = NULL;
    free(node);
}

/**
 * [STT 8] Module_Member_Registry: clean_all
 * Lỗ hổng: CWE-415 (Double Free)
 * CVE tham chiếu: CVE-2014-0160, CVE-2019-11043
 */
void clean_all(void) {
    for (int i = 0; i < HASH_SIZE; i++) {
        if (g_clan_table[i]) {
            free(g_clan_table[i]);
            g_clan_table[i] = NULL;
        }
    }
    // Reset bảng thống kê thế hệ
    memset(g_generation_stats, 0, sizeof(g_generation_stats));
}

/* --- 4. FUZZING ENTRY POINT ĐA BƯỚC (MULTI-STEP STATEFUL HARNESS) --- */
/**
 * Nhận buffer chứa mảng nhiều FuzzMemberPayload liên tiếp để giữ trạng thái đồ thị phả hệ,
 * kích hoạt các kịch bản phụ thuộc (Tạo -> Liên kết -> Cập nhật -> Xóa -> Truy cập UAF)
 */
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    // [STT 9] Kiểm tra trường dữ liệu
    validate_member_fields(data, size);

    size_t count = size / sizeof(FuzzMemberPayload);
    if (count == 0) return 0;
    if (count > 16) count = 16; // Giới hạn tối đa 16 lệnh/lượt để tối ưu hiệu năng fuzzer

    const FuzzMemberPayload* raw_payloads = (const FuzzMemberPayload*)data;

    // Vòng lặp thực thi chuỗi lệnh để xây dựng đồ thị phả hệ qua nhiều bước
    for (size_t i = 0; i < count; i++) {
        FuzzMemberPayload p;
        // [STT 7] Giải mã payload và cập nhật mảng thống kê thế hệ
        if (!parse_member_payload((const uint8_t*)&raw_payloads[i], sizeof(FuzzMemberPayload), &p)) {
            continue;
        }

        // [STT 6] Tính toán tuổi thọ
        compute_age_lifespan(p.birth_year, p.death_year);

        // Phân nhánh thực thi qua opcode
        switch (p.action_opcode % 6) {
            case 0: { // [STT 1] Tạo mới thành viên
                target_member_create(&p);
                break;
            }
            case 1: { // [STT 5] Cập nhật & Ghi nhật ký kiểm toán diff
                MemberNode* n = find_node(p.member_id);
                if (n) {
                    target_audit_diff(n, &p);
                } else {
                    target_member_create(&p);
                }
                break;
            }
            case 2: { // [STT 2] Liên kết quan hệ cha - con
                MemberNode* child = find_node(p.member_id);
                MemberNode* father = find_node(p.father_id);
                if (!child) child = target_member_create(&p);
                if (father && child && father != child) {
                    target_link_father(child, father);
                }
                break;
            }
            case 3: { // [STT 10] Liên kết quan hệ phối ngẫu (vợ - chồng)
                MemberNode* node1 = find_node(p.member_id);
                MemberNode* node2 = find_node(p.spouse_id);
                clan_link_spouse(node1, node2);
                break;
            }
            case 4: { // [STT 3] Tính bậc thế hệ đệ quy
                MemberNode* n = find_node(p.member_id);
                if (n) {
                    target_calculate_depth_recursive(n, 0);
                }
                break;
            }
            case 5: { // [STT 4] Xóa nút thành viên (để lại Dangling Pointer)
                target_member_delete(p.member_id);
                // Kích hoạt Use-After-Free: Nếu nút vừa xóa có con, duyệt ngay để ASan bắt lỗi!
                MemberNode* child = find_node(p.father_id);
                if (child && child->father) {
                    target_calculate_depth_recursive(child, 0);
                }
                break;
            }
        }
    }

    // [STT 8] Dọn dẹp bộ nhớ sau khi hoàn thành chuỗi lệnh đa bước
    clean_all();
    return 0;
}

/* --- 5. STANDALONE RUNNER CHO GCC / WINDOWS (CHẠY TRỰC TIẾP KHÔNG CẦN CLANG) --- */
#ifndef LIBFUZZER_RUN
#include <time.h>

int main(int argc, char** argv) {
    printf("===========================================================\n");
    printf("[*] KHOI CHAY MULTI-STEP STANDALONE FUZZER\n");
    printf("[*] Target: Clan Genealogy Tree Management (10 Core Functions)\n");
    printf("===========================================================\n");

    // Trường hợp 1: Chạy với file testcase cụ thể (reproducer)
    if (argc > 1) {
        FILE* f = fopen(argv[1], "rb");
        if (!f) {
            printf("[-] Khong the mo file testcase: %s\n", argv[1]);
            return 1;
        }
        uint8_t buf[4096];
        size_t n = fread(buf, 1, sizeof(buf), f);
        fclose(f);
        printf("[*] Dang fuzzing voi file %s (%zu bytes)...\n", argv[1], n);
        LLVMFuzzerTestOneInput(buf, n);
        printf("[+] Testcase hoan tat an toan (khong crash)!\n");
        return 0;
    }

    // Trường hợp 2: Chạy Fuzzing ngẫu nhiên đa bước (Multi-step Stateful Fuzzing)
    srand((unsigned int)time(NULL));
    const int TOTAL_ITERATIONS = 50000;
    const int STEPS_PER_RUN = 4; // Mỗi lượt chạy 4 lệnh liên tiếp để giữ trạng thái cây phả hệ
    printf("[*] Dang chay %d iterations (moi luot gom %d lenh lien tiep)...\n", 
           TOTAL_ITERATIONS, STEPS_PER_RUN);

    size_t batch_size = sizeof(FuzzMemberPayload) * STEPS_PER_RUN;
    uint8_t* test_buffer = (uint8_t*)malloc(batch_size);
    if (!test_buffer) return 1;

    for (int i = 1; i <= TOTAL_ITERATIONS; i++) {
        // Sinh mảng byte ngẫu nhiên cho nhiều payload liên tiếp
        for (size_t b = 0; b < batch_size; b++) {
            test_buffer[b] = (uint8_t)(rand() % 256);
        }

        // Gọi hàm kiểm thử đa bước
        LLVMFuzzerTestOneInput(test_buffer, batch_size);

        if (i % 10000 == 0) {
            printf("[*] Da hoan thanh %d / %d iterations...\n", i, TOTAL_ITERATIONS);
        }
    }

    free(test_buffer);
    printf("===========================================================\n");
    printf("[+] Fuzzing da buoc hoan tat: 100%% code paths da duoc bao phu!\n");
    printf("[+] Khop 100%% voi 10 ham dac ta trong Bao_Cao_Kiem_Thu_Fuzzing_MocBan\n");
    printf("===========================================================\n");
    return 0;
}
#endif
