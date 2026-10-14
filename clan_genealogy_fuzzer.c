/**
 * clan_genealogy_fuzzer.c
 * Fuzzing Harness kiểm thử luồng Quản lý Phả hệ (Whitebox Fuzzing)
 * Hệ thống: Quản lý Dòng họ (Mộc bản)
 * 
 * biên dịch với libFuzzer + AddressSanitizer + UndefinedBehaviorSanitizer:
 *    clang -fsanitize=fuzzer,address,undefined -g -O1 clan_genealogy_fuzzer.c -o fuzzer_clan
 * 
 * Chạy fuzzing:
 *    mkdir -p corpus
 *    ./fuzzer_clan corpus/ -max_len=512 -runs=10000000
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
#define AUDIT_BUF_SIZE 256

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
    uint8_t  action_opcode; // 0: Add, 1: Update, 2: Link, 3: Calculate, 4: Delete
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

/* Bảng hash đơn giản mô phỏng CSDL lưu trữ node */
#define HASH_SIZE 64
static MemberNode* g_clan_table[HASH_SIZE] = {0};

static MemberNode* find_node(uint32_t id) {
    if (id == 0) return NULL;
    return g_clan_table[id % HASH_SIZE];
}

/* --- 3. CÁC HÀM MỤC TIÊU CẦN KIỂM THỬ (TARGET FUNCTIONS) --- */

/* Hàm tạo mới thành viên */
static MemberNode* target_member_create(const FuzzMemberPayload* p) {
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

    /* Sao chép chuỗi */
    strncpy(node->full_name, p->full_name, sizeof(node->full_name) - 1);
    node->full_name[sizeof(node->full_name) - 1] = '\0';

    strncpy(node->lunar_date, p->lunar_date, sizeof(node->lunar_date) - 1);
    node->lunar_date[sizeof(node->lunar_date) - 1] = '\0';

    strncpy(node->address, p->address, sizeof(node->address) - 1);
    node->address[sizeof(node->address) - 1] = '\0';

    g_clan_table[p->member_id % HASH_SIZE] = node;
    return node;
}

/* Hàm liên kết huyết thống & kiểm tra chu trình */
static bool target_link_father(MemberNode* child, MemberNode* father) {
    if (!child || !father) return false;
    if (child == father) return false; // Tự nhận mình là cha

    /* Kiểm tra chu trình lặp vô hạn */
    MemberNode* curr = father;
    int depth = 0;
    while (curr != NULL && depth < 50) {
        if (curr == child) {
            return false; // Phát hiện cycle: con là tổ tiên của cha
        }
        curr = curr->father;
        depth++;
    }

    child->father = father;
    /* Lỗ hổng Integer/Array Bounds: Nếu child_count vượt quá MAX_CHILDREN */
    if (father->child_count < MAX_CHILDREN) {
        father->children[father->child_count] = child;
        father->child_count++;
    }
    return true;
}

/* Hàm đệ quy leo cây tính bậc thế hệ */
static int target_calculate_depth_recursive(const MemberNode* node, int current_depth) {
    if (!node) return current_depth;
    if (current_depth > 100) {
        // Ngăn chặn đệ quy vô hạn khi có cycle chưa phát hiện
        return -1;
    }
    return target_calculate_depth_recursive(node->father, current_depth + 1);
}

/* Hàm tạo chuỗi kiểm toán thay đổi (Audit Diff) */
static void target_audit_diff(const MemberNode* old_node, const FuzzMemberPayload* new_p) {
    char audit_buf[AUDIT_BUF_SIZE];
    /* Lỗ hổng Format String / Buffer Overflow tiềm ẩn nếu chuỗi quá dài */
    int written = snprintf(audit_buf, sizeof(audit_buf),
        "DIFF member [%u]: Name=[%s] -> [%s], Gen=[%d] -> [%d]",
        old_node->id, old_node->full_name, new_p->full_name,
        old_node->generation, new_p->generation);

    if (written >= (int)sizeof(audit_buf)) {
        // Đã cắt cụt chuỗi
    }
}

/* Hàm xóa nút thành viên - Kiểm tra rủi ro Use-After-Free */
static void target_member_delete(uint32_t id) {
    MemberNode* node = find_node(id);
    if (!node) return;

    /* RỦI RO: Giải phóng node nhưng các liên kết từ node con trỏ về vẫn còn */
    g_clan_table[id % HASH_SIZE] = NULL;
    free(node);
}

/* Dọn dẹp toàn bộ bảng sau mỗi lần fuzz */
static void clean_all(void) {
    for (int i = 0; i < HASH_SIZE; i++) {
        if (g_clan_table[i]) {
            free(g_clan_table[i]);
            g_clan_table[i] = NULL;
        }
    }
}

/* --- 4. FUZZING ENTRY POINT (libFuzzer API) --- */
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    if (size < sizeof(FuzzMemberPayload)) {
        return 0; // Kích thước không đủ để ép kiểu thành payload
    }

    // Ép kiểu dữ liệu fuzzer thành struct payload phả hệ
    const FuzzMemberPayload* payload = (const FuzzMemberPayload*)data;

    // Dispatcher kích hoạt các nhánh chức năng dựa trên opcode
    switch (payload->action_opcode % 5) {
        case 0: { // Thêm mới
            target_member_create(payload);
            break;
        }
        case 1: { // Cập nhật & Audit Log
            MemberNode* n = find_node(payload->member_id);
            if (n) {
                target_audit_diff(n, payload);
            } else {
                target_member_create(payload);
            }
            break;
        }
        case 2: { // Liên kết quan hệ cha-con
            MemberNode* child = find_node(payload->member_id);
            MemberNode* father = find_node(payload->father_id);
            if (!child) child = target_member_create(payload);
            if (father && child) {
                target_link_father(child, father);
            }
            break;
        }
        case 3: { // Tính toán đệ quy độ sâu thế hệ
            MemberNode* n = find_node(payload->member_id);
            if (n) {
                target_calculate_depth_recursive(n, 0);
            }
            break;
        }
        case 4: { // Xóa nút phả hệ (Kích hoạt Use-After-Free)
            target_member_delete(payload->member_id);
            break;
        }
    }

    // Giải phóng bộ nhớ để tránh tích lũy giữa các lượt chạy fuzz
    clean_all();
    return 0;
}

/* --- 5. STANDALONE RUNNER CHO GCC / WINDOWS (CHẠY TRỰC TIẾP KHÔNG CẦN CLANG) --- */
#ifndef LIBFUZZER_RUN
#include <time.h>

int main(int argc, char** argv) {
    printf("===========================================================\n");
    printf("[*] KHOI CHAY STANDALONE FUZZER (He thong Quan ly Dong ho)\n");
    printf("[*] Target: Genealogy Tree and Hierarchy Module\n");
    printf("===========================================================\n");

    // Truong hop 1: Chay voi 1 file testcase cu the (reproducer)
    if (argc > 1) {
        FILE* f = fopen(argv[1], "rb");
        if (!f) {
            printf("[-] Khong the mo file testcase: %s\n", argv[1]);
            return 1;
        }
        uint8_t buf[1024];
        size_t n = fread(buf, 1, sizeof(buf), f);
        fclose(f);
        printf("[*] Dang fuzzing voi file %s (%zu bytes)...\n", argv[1], n);
        LLVMFuzzerTestOneInput(buf, n);
        printf("[+] Testcase hoan tat an toan (khong crash)!\n");
        return 0;
    }

    // Truong hop 2: Che do In-process random fuzzing (50,000 iterations)
    srand((unsigned int)time(NULL));
    const int TOTAL_ITERATIONS = 50000;
    printf("[*] Dang chay %d luot sinh payload ngau nhien...\n", TOTAL_ITERATIONS);

    for (int i = 1; i <= TOTAL_ITERATIONS; i++) {
        uint8_t test_data[sizeof(FuzzMemberPayload)];
        for (size_t b = 0; b < sizeof(test_data); b++) {
            test_data[b] = (uint8_t)(rand() % 256);
        }

        // Goi ham muc tieu
        LLVMFuzzerTestOneInput(test_data, sizeof(test_data));

        if (i % 10000 == 0) {
            printf("[*] Da hoan thanh %d / %d iterations...\n", i, TOTAL_ITERATIONS);
        }
    }

    printf("===========================================================\n");
    printf("[+] Fuzzing hoan tat: Da chay thanh cong %d iterations!\n", TOTAL_ITERATIONS);
    printf("[+] San sang bien dich voi Clang libFuzzer/AFL++ de san crash sau!\n");
    printf("===========================================================\n");
    return 0;
}
#endif

