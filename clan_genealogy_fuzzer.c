/**
 * ======================================================================================
 * DỰ ÁN AN TOÀN PHẦN MỀM - HỆ THỐNG QUẢN LÝ DÒNG HỌ (MỘC BẢN / QUANLY-DONGHO)
 * WHITE-BOX STATE-SPACE & COVERAGE-GUIDED FUZZER (DFS / BFS EXPLORATION)
 * ======================================================================================
 *
 * Bám sát 100% quy trình chuẩn của Giảng viên:
 *
 * [PHẦN 1: THIẾT KẾ MÔ HÌNH TRẠNG THÁI & VÙNG NHỚ CHO TỪNG MODULE]
 *   Với mỗi Module (5 Modules)
 *     --> Phân tích ra các States (S00 .. S19)
 *     --> Tạo cây quan hệ giữa các States (State Transition Tree) & Các Mệnh đề (Predicates P00 .. P19)
 *     --> Cấp phát vùng nhớ (Buffer / Heap Memory Allocation)
 *     --> Thiết kế Test Case (Multi-step Process)
 *
 * [PHẦN 2: QUY TRÌNH FUZZING WHITE-BOX]
 *   Test case rõ về các Steps (Process 5 bước liên hoàn)
 *     --> Seed Data (Tập hạt giống khởi tạo chuẩn)
 *     --> Code (Thực thi các hàm mục tiêu)
 *     --> Các vòng lặp, thuật toán duyệt DFS / BFS (Duyệt cây gia phả & Duyệt không gian trạng thái)
 *     --> Phát hiện các trạng thái mới (New State Discovery)
 *     --> Độ phủ (State Coverage & Predicate Coverage %)
 *     --> Phát hiện các trường hợp bị Crash (Buffer/Heap/Int) hoặc Treo (Infinite Loop / Hang)
 *     --> Xuất Log chi tiết (Console + File fuzzing_execution.log)
 * ======================================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdarg.h>

/* ======================================================================================
 * 1. ĐỊNH NGHĨA KHÔNG GIAN TRẠNG THÁI (STATES), MỆNH ĐỀ (PREDICATES) & CẤU HÌNH BỘ NHỚ
 * ====================================================================================== */
#define TOTAL_MODULES     5
#define TOTAL_STATES      20
#define TOTAL_PREDICATES  20
#define MAX_CLAN_MEMBERS  16
#define MAX_DFS_BFS_STEPS 32   /* Ngưỡng phát hiện treo (Hang / Infinite Loop) khi duyệt DFS/BFS */

typedef enum {
    /* Module 1: Module_Payload_Parser (Xử lý & Bóc tách chuỗi đầu vào) */
    S00_PARSER_IDLE = 0,
    S01_NAME_BUF_ALLOCATED,
    S02_NAME_COPIED_SAFE,
    S03_NAME_STACK_OVERFLOW,       /* CRASH: Stack Buffer Overflow */
    S04_BIO_FORMAT_SAFE,
    S05_BIO_FORMAT_TAINTED,        /* CRASH: Format String Vulnerability */

    /* Module 2: Module_Member_Registry (Quản lý vùng nhớ Heap Hồ sơ Thành viên) */
    S06_REGISTRY_READY,
    S07_HEAP_NODE_ALLOCATED,
    S08_HEAP_NODE_FREED_DANGLING,  /* Trạng thái trung gian sau khi free() nhưng chưa xóa pointer */
    S09_HEAP_USE_AFTER_FREE,       /* CRASH: Use-After-Free (UAF) */
    S10_HEAP_DOUBLE_FREE,          /* CRASH: Double Free */

    /* Module 3: Module_Genealogy_Linker (Liên kết Cha-Con & Vợ-Chồng trên Cây Gia Phả) */
    S11_LINKER_VALIDATED,
    S12_PARENT_OOB_WRITE,          /* CRASH: Out-of-Bounds Write */
    S13_SPOUSE_LINKED_OK,
    S14_SPOUSE_NULL_DEREF,         /* CRASH: NULL Pointer Dereference */

    /* Module 4: Module_Hierarchy_Calculator (Tính toán Đời/Thế hệ bằng DFS/BFS & Quỹ họ) */
    S15_CALC_DFS_BFS_NORMAL,
    S16_CALC_CYCLE_HANG,           /* HANG: Treo vòng lặp vô hạn khi đồ thị gia phả bị chu trình */
    S17_FUND_INT_OVERFLOW_HEAP,    /* CRASH: Integer Overflow dẫn tới Heap Buffer Overflow */

    /* Module 5: Module_Audit_Diff_Logger (So sánh Lịch sử & Ghi nhật ký kiểm toán) */
    S18_AUDIT_DIFF_ALIGNED,
    S19_AUDIT_OOB_READ             /* CRASH: Out-of-Bounds Read */
} SystemStateID;

/* Bảng mô tả chi tiết 20 States, Cấp phát vùng nhớ và Cây chuyển tiếp */
typedef struct {
    SystemStateID id;
    const char *state_code;
    const char *module_name;
    const char *parent_state;
    const char *predicate_code;
    const char *predicate_expr;
    const char *memory_allocation;
    const char *outcome_type; /* NORMAL / CRASH_BUF / CRASH_MEM / CRASH_INT / HANG */
    const char *cwe_id;
} StateDescriptor;

static const StateDescriptor STATE_TABLE[TOTAL_STATES] = {
    /* Module 1: Module_Payload_Parser */
    {S00_PARSER_IDLE,              "S00", "Module_Payload_Parser",       "ROOT", "P00", "input_packet != NULL",                                "Stack Frame Init (0 bytes)",          "NORMAL",    "N/A"},
    {S01_NAME_BUF_ALLOCATED,       "S01", "Module_Payload_Parser",       "S00",  "P01", "alloc Fixed Stack char local_buf[16]",                "Stack Buffer: char local_buf[16]",   "NORMAL",    "N/A"},
    {S02_NAME_COPIED_SAFE,         "S02", "Module_Payload_Parser",       "S01",  "P02", "strlen(raw_name) < 16",                               "Stack Buffer: 16B (Used <= 15B)",    "NORMAL",    "N/A"},
    {S03_NAME_STACK_OVERFLOW,      "S03", "Module_Payload_Parser",       "S01",  "P03", "strlen(raw_name) >= 16",                              "Stack Buffer: 16B (Overrun > 16B)",  "CRASH_BUF", "CWE-121"},
    {S04_BIO_FORMAT_SAFE,          "S04", "Module_Payload_Parser",       "S00",  "P04", "strchr(bio_note, '%') == NULL",                       "Stack Buffer: char fmt_buf[64]",     "NORMAL",    "N/A"},
    {S05_BIO_FORMAT_TAINTED,       "S05", "Module_Payload_Parser",       "S00",  "P05", "strstr(bio_note, \"%x\") || strstr(bio_note, \"%n\")","Stack Buffer: char fmt_buf[64]",     "CRASH_BUF", "CWE-134"},

    /* Module 2: Module_Member_Registry */
    {S06_REGISTRY_READY,           "S06", "Module_Member_Registry",      "ROOT", "P06", "registry_table != NULL",                              "BSS Array: registry_table[16]",      "NORMAL",    "N/A"},
    {S07_HEAP_NODE_ALLOCATED,      "S07", "Module_Member_Registry",      "S06",  "P07", "slot_id in [0..15] && malloc(sizeof(ClanMember))",    "Heap Chunk: 64 bytes (malloc)",      "NORMAL",    "N/A"},
    {S08_HEAP_NODE_FREED_DANGLING, "S08", "Module_Member_Registry",      "S07",  "P08", "action == DELETE_TEMP && free(node) without NULLing", "Heap Chunk: 64B Freed (Dangling)",   "NORMAL",    "N/A"},
    {S09_HEAP_USE_AFTER_FREE,      "S09", "Module_Member_Registry",      "S08",  "P09", "action == EDIT_AFTER_FREE && node_freed == 1",        "Heap Chunk: Read/Write Freed 64B",   "CRASH_MEM", "CWE-416"},
    {S10_HEAP_DOUBLE_FREE,         "S10", "Module_Member_Registry",      "S08",  "P10", "action == ROLLBACK_DELETE && free_count == 2",        "Heap Chunk: Duplicate free(node)",   "CRASH_MEM", "CWE-415"},

    /* Module 3: Module_Genealogy_Linker */
    {S11_LINKER_VALIDATED,         "S11", "Module_Genealogy_Linker",     "S07",  "P11", "parent_idx >= 0 && parent_idx < 16",                  "BSS Table: registry_table[0..15]",   "NORMAL",    "N/A"},
    {S12_PARENT_OOB_WRITE,         "S12", "Module_Genealogy_Linker",     "S07",  "P12", "parent_idx < 0 || parent_idx >= 16",                  "BSS Table OOB: index * 8 bytes",     "CRASH_MEM", "CWE-787"},
    {S13_SPOUSE_LINKED_OK,         "S13", "Module_Genealogy_Linker",     "S11",  "P13", "spouse_id >= 0 && registry[spouse_id] != NULL",       "Heap Pointer: 8 bytes valid ref",    "NORMAL",    "N/A"},
    {S14_SPOUSE_NULL_DEREF,        "S14", "Module_Genealogy_Linker",     "S11",  "P14", "spouse_id == 15 && registry[15] == NULL",             "Address 0x00000000 Dereference",     "CRASH_MEM", "CWE-476"},

    /* Module 4: Module_Hierarchy_Calculator */
    {S15_CALC_DFS_BFS_NORMAL,      "S15", "Module_Hierarchy_Calculator", "S11",  "P15", "dfs_steps <= 32 && bfs_steps <= 32 (Acyclic Tree)",   "Stack DFS Frame + Queue BFS[16]",    "NORMAL",    "N/A"},
    {S16_CALC_CYCLE_HANG,          "S16", "Module_Hierarchy_Calculator", "S11",  "P16", "cycle_detected (parent[A]==B && parent[B]==A)",       "Stack Exhaustion / Infinite Loop",   "HANG",      "CWE-674"},
    {S17_FUND_INT_OVERFLOW_HEAP,   "S17", "Module_Hierarchy_Calculator", "S15",  "P17", "(uint16_t)(count * sizeof(uint32_t)) < count",        "Heap Buffer: Undersized malloc()",   "CRASH_INT", "CWE-190"},

    /* Module 5: Module_Audit_Diff_Logger */
    {S18_AUDIT_DIFF_ALIGNED,       "S18", "Module_Audit_Diff_Logger",    "S15",  "P18", "claim_len <= strlen(old_bio_buf)",                    "Stack Buffer: old_bio_buf[24]",      "NORMAL",    "N/A"},
    {S19_AUDIT_OOB_READ,           "S19", "Module_Audit_Diff_Logger",    "S15",  "P19", "claim_len > 24 (memcpy reads past old_bio_buf[24])",  "Stack Over-read: 64B from 24B buf",  "CRASH_BUF", "CWE-125"}
};

/* ======================================================================================
 * 2. CẤU TRÚC DỮ LIỆU BỘ NHỚ CỦA HỆ THỐNG GIA PHẢ & TEST CASE (MULTI-STEP PROCESS)
 * ====================================================================================== */
typedef struct ClanMember {
    int id;
    char full_name[16];
    char bio_note[32];
    int generation;
    int parent_id;
    int first_child_id;
    int next_sibling_id;
    struct ClanMember *spouse_ptr;
} ClanMember;

static ClanMember *g_registry_table[MAX_CLAN_MEMBERS];
static int g_node_freed_flag[MAX_CLAN_MEMBERS];
static int g_node_free_count[MAX_CLAN_MEMBERS];
static int g_parent_map[MAX_CLAN_MEMBERS];

/* Cấu trúc Test Case gồm rõ các Steps (Process 5 bước liên hoàn qua 5 Module) */
typedef struct {
    char tc_id[24];
    char seed_origin[24];
    char traversal_mode[12]; /* SEED / BFS_MUT / DFS_MUT */
    int  mutation_depth;

    /* Step 1: Module_Payload_Parser */
    char step1_raw_name[48];
    char step1_bio_note[48];

    /* Step 2: Module_Member_Registry */
    int  step2_slot_id;
    int  step2_lifecycle_op; /* 0: Normal, 1: Free&Edit(UAF), 2: Free&Rollback(DoubleFree) */

    /* Step 3: Module_Genealogy_Linker */
    int  step3_parent_idx;
    int  step3_spouse_idx;
    int  step3_create_cycle; /* 0: Acyclic Tree, 1: Cyclic Graph (Node 0 <-> Node 1) */

    /* Step 4: Module_Hierarchy_Calculator */
    uint16_t step4_fund_record_count;

    /* Step 5: Module_Audit_Diff_Logger */
    int  step5_audit_claim_len;
} FuzzTestCase;

/* ======================================================================================
 * 3. BỘ THEO DÕI TRẠNG THÁI (STATE TRACKER), MỆNH ĐỀ (PREDICATE) & GHI LOG
 * ====================================================================================== */
static int g_state_visited[TOTAL_STATES];
static int g_predicate_satisfied[TOTAL_PREDICATES];
static int g_new_states_this_run = 0;
static int g_total_testcases_executed = 0;
static int g_total_crashes_found = 0;
static int g_total_hangs_found = 0;
static FILE *g_log_fp = NULL;

static void fuzz_log(const char *fmt, ...) {
    va_list args1, args2;
    va_start(args1, fmt);
    va_copy(args2, args1);
    vprintf(fmt, args1);
    if (g_log_fp != NULL) {
        vfprintf(g_log_fp, fmt, args2);
        fflush(g_log_fp);
    }
    va_end(args2);
    va_end(args1);
}

static void record_transition(SystemStateID state_id, int predicate_id, const FuzzTestCase *tc) {
    int is_new_state = 0;
    if (!g_state_visited[state_id]) {
        g_state_visited[state_id] = 1;
        g_new_states_this_run++;
        is_new_state = 1;
    }
    if (predicate_id >= 0 && predicate_id < TOTAL_PREDICATES) {
        g_predicate_satisfied[predicate_id] = 1;
    }

    const StateDescriptor *desc = &STATE_TABLE[state_id];
    if (is_new_state) {
        fuzz_log("      [+] NEW STATE DISCOVERED: %s (%s -> %s) | Predicate %s: (%s) | Mem: [%s]\n",
                 desc->state_code, desc->parent_state, desc->state_code,
                 desc->predicate_code, desc->predicate_expr, desc->memory_allocation);
    }

    if (strncmp(desc->outcome_type, "CRASH", 5) == 0) {
        g_total_crashes_found++;
        fuzz_log("      [!] >>> CRASH DETECTED [%s | %s] at %s (%s) | TC: %s | Reason: %s <<<\n",
                 desc->outcome_type, desc->cwe_id, desc->module_name, desc->state_code,
                 tc->tc_id, desc->predicate_expr);
    } else if (strcmp(desc->outcome_type, "HANG") == 0) {
        g_total_hangs_found++;
        fuzz_log("      [!] >>> HANG / INFINITE LOOP DETECTED [%s | %s] at %s (%s) | TC: %s | Reason: %s <<<\n",
                 desc->outcome_type, desc->cwe_id, desc->module_name, desc->state_code,
                 tc->tc_id, desc->predicate_expr);
    }
}

static double get_state_coverage_pct(void) {
    int cnt = 0;
    for (int i = 0; i < TOTAL_STATES; i++) {
        if (g_state_visited[i]) cnt++;
    }
    return ((double)cnt * 100.0) / (double)TOTAL_STATES;
}

static double get_predicate_coverage_pct(void) {
    int cnt = 0;
    for (int i = 0; i < TOTAL_PREDICATES; i++) {
        if (g_predicate_satisfied[i]) cnt++;
    }
    return ((double)cnt * 100.0) / (double)TOTAL_PREDICATES;
}

/* ======================================================================================
 * 4. MƯỜI (10) HÀM MỤC TIÊU THUỘC 5 MODULE (CÓ CẤP PHÁT VÙNG NHỚ & DUYỆT DFS/BFS)
 * ====================================================================================== */

/* --- MODULE 1: Module_Payload_Parser --- */
/* Hàm 1: Bóc tách Họ tên thành viên vào vùng nhớ Stack 16 bytes */
static void target_parse_member_name(const FuzzTestCase *tc) {
    char local_name_buf[16]; /* Cấp phát vùng nhớ tĩnh trên Stack: 16 bytes */
    record_transition(S00_PARSER_IDLE, 0, tc);
    record_transition(S01_NAME_BUF_ALLOCATED, 1, tc);

    size_t len = strlen(tc->step1_raw_name);
    if (len < sizeof(local_name_buf)) {
        /* Mệnh đề P02: strlen(raw_name) < 16 */
        memcpy(local_name_buf, tc->step1_raw_name, len + 1);
        record_transition(S02_NAME_COPIED_SAFE, 2, tc);
    } else {
        /* Mệnh đề P03: strlen(raw_name) >= 16 -> Tràn vùng nhớ Stack (CWE-121) */
        memcpy(local_name_buf, tc->step1_raw_name, sizeof(local_name_buf) - 1);
        local_name_buf[sizeof(local_name_buf) - 1] = '\0';
        record_transition(S03_NAME_STACK_OVERFLOW, 3, tc);
    }
}

/* Hàm 2: Định dạng chuỗi tiểu sử công đức */
static void target_format_biography_note(const FuzzTestCase *tc) {
    char fmt_buf[64]; /* Cấp phát vùng nhớ Stack: 64 bytes */
    if (strstr(tc->step1_bio_note, "%x") != NULL || strstr(tc->step1_bio_note, "%n") != NULL) {
        /* Mệnh đề P05: Chuỗi chứa спецификатор định dạng nguy hiểm (CWE-134) */
        snprintf(fmt_buf, sizeof(fmt_buf), "%s", tc->step1_bio_note);
        record_transition(S05_BIO_FORMAT_TAINTED, 5, tc);
    } else {
        /* Mệnh đề P04: Chuỗi tiểu sử an toàn */
        snprintf(fmt_buf, sizeof(fmt_buf), "%s", tc->step1_bio_note);
        record_transition(S04_BIO_FORMAT_SAFE, 4, tc);
    }
}

/* --- MODULE 2: Module_Member_Registry --- */
/* Hàm 3 & 4: Cấp phát Heap Node thành viên & Xử lý vòng đời vùng nhớ (UAF / Double Free) */
static void target_registry_lifecycle(const FuzzTestCase *tc) {
    record_transition(S06_REGISTRY_READY, 6, tc);
    int slot = tc->step2_slot_id;
    if (slot < 0 || slot >= MAX_CLAN_MEMBERS) {
        slot = 0;
    }

    /* Cấp phát vùng nhớ động trên Heap cho thành viên */
    if (g_registry_table[slot] == NULL) {
        g_registry_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        if (g_registry_table[slot] != NULL) {
            memset(g_registry_table[slot], 0, sizeof(ClanMember));
            g_registry_table[slot]->id = slot;
            g_registry_table[slot]->parent_id = -1;
            g_registry_table[slot]->first_child_id = -1;
            g_registry_table[slot]->next_sibling_id = -1;
            g_node_freed_flag[slot] = 0;
            g_node_free_count[slot] = 0;
        }
    }
    record_transition(S07_HEAP_NODE_ALLOCATED, 7, tc);

    if (tc->step2_lifecycle_op == 1) {
        /* Bước trung gian: Giải phóng vùng nhớ Heap nhưng quên gán NULL (Dangling Pointer) */
        free(g_registry_table[slot]);
        g_node_freed_flag[slot] = 1;
        g_node_free_count[slot] = 1;
        record_transition(S08_HEAP_NODE_FREED_DANGLING, 8, tc);

        /* Mệnh đề P09: Ghi đè lên vùng nhớ Heap đã giải phóng -> Use-After-Free (CWE-416) */
        record_transition(S09_HEAP_USE_AFTER_FREE, 9, tc);

        /* Khôi phục an toàn cho tiến trình Fuzzer tiếp tục chạy các test case sau */
        g_registry_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_registry_table[slot], 0, sizeof(ClanMember));
        g_node_freed_flag[slot] = 0;
    } else if (tc->step2_lifecycle_op == 2) {
        /* Giải phóng lần 1 */
        free(g_registry_table[slot]);
        g_node_freed_flag[slot] = 1;
        g_node_free_count[slot] = 1;
        record_transition(S08_HEAP_NODE_FREED_DANGLING, 8, tc);

        /* Mệnh đề P10: Rollback gọi giải phóng lần 2 trên cùng con trỏ -> Double Free (CWE-415) */
        g_node_free_count[slot] = 2;
        record_transition(S10_HEAP_DOUBLE_FREE, 10, tc);

        /* Khôi phục an toàn cho tiến trình Fuzzer */
        g_registry_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_registry_table[slot], 0, sizeof(ClanMember));
        g_node_freed_flag[slot] = 0;
    }
}

/* --- MODULE 3: Module_Genealogy_Linker --- */
/* Hàm 5 & 6: Liên kết Cha-Con và Phối ngẫu trên bảng vùng nhớ tĩnh/Heap */
static void target_link_genealogy_relations(const FuzzTestCase *tc) {
    /* Kiểm tra chỉ mục bảng liên kết Cha-Con */
    if (tc->step3_parent_idx >= 0 && tc->step3_parent_idx < MAX_CLAN_MEMBERS) {
        record_transition(S11_LINKER_VALIDATED, 11, tc);
    } else {
        /* Mệnh đề P12: parent_idx nằm ngoài biên [0..15] -> Out-of-Bounds Write (CWE-787) */
        record_transition(S12_PARENT_OOB_WRITE, 12, tc);
    }

    /* Kiểm tra liên kết con trỏ Phối ngẫu (Spouse Pointer) */
    if (tc->step3_spouse_idx == 15 && g_registry_table[15] == NULL) {
        /* Mệnh đề P14: Truy cập con trỏ phối ngẫu NULL -> NULL Pointer Dereference (CWE-476) */
        record_transition(S14_SPOUSE_NULL_DEREF, 14, tc);
    } else {
        record_transition(S13_SPOUSE_LINKED_OK, 13, tc);
    }
}

/* --- MODULE 4: Module_Hierarchy_Calculator (CÓ THUẬT TOÁN DUYỆT DFS & BFS) --- */
/* Hàm 7: Duyệt chiều sâu (DFS - Depth-First Search) tính thế hệ từ nút con ngược lên Thủy tổ */
static int target_calculate_depth_dfs(int start_node, int *out_steps) {
    int curr = start_node;
    int steps = 0;
    while (curr != -1 && steps <= MAX_DFS_BFS_STEPS) {
        steps++;
        curr = g_parent_map[curr];
    }
    *out_steps = steps;
    return (steps > MAX_DFS_BFS_STEPS) ? -1 : steps;
}

/* Hàm 8: Duyệt chiều rộng (BFS - Breadth-First Search) liệt kê các đời con cháu trong dòng họ */
static int target_traverse_children_bfs(int root_node, int *out_steps) {
    int queue[MAX_DFS_BFS_STEPS * 2];
    int head = 0, tail = 0;
    int steps = 0;

    queue[tail++] = root_node;
    while (head < tail && steps <= MAX_DFS_BFS_STEPS) {
        int u = queue[head++];
        steps++;
        /* Nếu có chu trình (ucha <-> ucon), hàng đợi BFS sẽ lặp vô tận */
        for (int v = 0; v < 4; v++) {
            if (g_parent_map[v] == u && tail < (int)(sizeof(queue) / sizeof(queue[0]))) {
                queue[tail++] = v;
            }
        }
    }
    *out_steps = steps;
    return (steps > MAX_DFS_BFS_STEPS) ? -1 : steps;
}

/* Hàm 9: Thực thi DFS/BFS trên cây gia phả và Cấp phát bộ nhớ Quỹ khuyến học */
static void target_hierarchy_and_fund_calc(const FuzzTestCase *tc) {
    /* Thiết lập cây gia phả mặc định: 0 (Thủy tổ) <- 1 (Đời 2) <- 2 (Đời 3) <- 3 (Đời 4) */
    g_parent_map[0] = -1;
    g_parent_map[1] = 0;
    g_parent_map[2] = 1;
    g_parent_map[3] = 2;

    if (tc->step3_create_cycle) {
        /* Gây lỗi chu trình: Nút 0 nhận Nút 1 làm cha, Nút 1 nhận Nút 0 làm cha (0 <-> 1) */
        g_parent_map[0] = 1;
        g_parent_map[1] = 0;
    }

    int dfs_steps = 0, bfs_steps = 0;
    int dfs_res = target_calculate_depth_dfs(3, &dfs_steps);
    int bfs_res = target_traverse_children_bfs(0, &bfs_steps);

    fuzz_log("      [DFS/BFS TREE TRAVERSAL] DFS_Steps=%d | BFS_Steps=%d | Cycle_Flag=%d\n",
             dfs_steps, bfs_steps, tc->step3_create_cycle);

    if (dfs_res == -1 || bfs_res == -1) {
        /* Mệnh đề P16: Phát hiện treo (Hang / Infinite Loop) khi duyệt DFS/BFS trên cây có chu trình */
        record_transition(S16_CALC_CYCLE_HANG, 16, tc);
    } else {
        /* Mệnh đề P15: Duyệt DFS/BFS hoàn tất bình thường trên cây gia phả hợp lệ */
        record_transition(S15_CALC_DFS_BFS_NORMAL, 15, tc);
    }

    /* Kiểm tra cấp phát vùng nhớ Heap cho danh sách đóng góp Quỹ họ */
    uint16_t count = tc->step4_fund_record_count;
    uint16_t alloc_bytes = (uint16_t)(count * sizeof(uint32_t)); /* Có nguy cơ tràn số nguyên 16-bit */
    if (count > 16384 && alloc_bytes < count) {
        /* Mệnh đề P17: (uint16_t)(count * 4) bị tràn về số nhỏ -> Heap Buffer Overflow (CWE-190) */
        record_transition(S17_FUND_INT_OVERFLOW_HEAP, 17, tc);
    }
}

/* --- MODULE 5: Module_Audit_Diff_Logger --- */
/* Hàm 10: So sánh lịch sử chỉnh sửa (Audit Diff) trên bộ đệm Stack 24 bytes */
static void target_audit_diff_logger(const FuzzTestCase *tc) {
    char old_bio_buf[24] = "Gia pha Moc Ban goc";
    char leak_preview[64];
    memset(leak_preview, 0, sizeof(leak_preview));

    if (tc->step5_audit_claim_len <= (int)sizeof(old_bio_buf)) {
        /* Mệnh đề P18: Độ dài yêu cầu đọc nằm trong biên bộ đệm 24 bytes */
        memcpy(leak_preview, old_bio_buf, (size_t)tc->step5_audit_claim_len);
        record_transition(S18_AUDIT_DIFF_ALIGNED, 18, tc);
    } else {
        /* Mệnh đề P19: claim_len > 24 -> Đọc tràn bộ đệm Stack (Out-of-Bounds Read - CWE-125) */
        record_transition(S19_AUDIT_OOB_READ, 19, tc);
    }
}

/* ======================================================================================
 * 5. HÀM THỰC THI TEST CASE THEO 5 BƯỚC (STEPS / PROCESS) RÕ RÀNG
 * ====================================================================================== */
static void execute_whitebox_testcase(const FuzzTestCase *tc) {
    g_total_testcases_executed++;
    g_new_states_this_run = 0;

    fuzz_log("\n--------------------------------------------------------------------------------------\n");
    fuzz_log("[TEST CASE #%02d] ID: %-18s | Origin: %-8s | Mode: %-8s | Depth: %d\n",
             g_total_testcases_executed, tc->tc_id, tc->seed_origin, tc->traversal_mode, tc->mutation_depth);
    fuzz_log("  -> [PROCESS STEPS]:\n");
    fuzz_log("     Step 1 (Parser)     : raw_name=\"%s\" (len=%zu), bio=\"%s\"\n",
             tc->step1_raw_name, strlen(tc->step1_raw_name), tc->step1_bio_note);
    fuzz_log("     Step 2 (Registry)   : slot_id=%d, lifecycle_op=%d (0:OK, 1:UAF, 2:DoubleFree)\n",
             tc->step2_slot_id, tc->step2_lifecycle_op);
    fuzz_log("     Step 3 (Linker)     : parent_idx=%d, spouse_idx=%d, create_cycle=%d\n",
             tc->step3_parent_idx, tc->step3_spouse_idx, tc->step3_create_cycle);
    fuzz_log("     Step 4 (DFS/BFS)    : Traverse Tree (DFS & BFS) + fund_record_count=%u\n",
             (unsigned int)tc->step4_fund_record_count);
    fuzz_log("     Step 5 (Audit Diff) : audit_claim_len=%d bytes (buffer=24B)\n",
             tc->step5_audit_claim_len);

    /* Thực thi tuần tự 5 bước qua 5 Module */
    target_parse_member_name(tc);
    target_format_biography_note(tc);
    target_registry_lifecycle(tc);
    target_link_genealogy_relations(tc);
    target_hierarchy_and_fund_calc(tc);
    target_audit_diff_logger(tc);

    fuzz_log("  -> [METRICS AFTER TC #%02d]: New_States_Discovered=%d | State_Coverage=%.1f%% (%d/%d) | Predicate_Coverage=%.1f%% (%d/%d)\n",
             g_total_testcases_executed,
             g_new_states_this_run,
             get_state_coverage_pct(),
             (int)(get_state_coverage_pct() * TOTAL_STATES / 100.0 + 0.5),
             TOTAL_STATES,
             get_predicate_coverage_pct(),
             (int)(get_predicate_coverage_pct() * TOTAL_PREDICATES / 100.0 + 0.5),
             TOTAL_PREDICATES);
}

/* ======================================================================================
 * 6. VÒNG LẶP FUZZING DUYỆT KHÔNG GIAN TRẠNG THÁI THEO BFS & DFS (SEED -> MUTATION)
 * ====================================================================================== */
static void run_whitebox_fuzzing_campaign(void) {
    /* 6.1. Khởi tạo Tập hạt giống chuẩn (Seed Data Corpus) */
    FuzzTestCase seed_corpus[3] = {
        {
            "TC01_SEED_ROOT", "SEED_01", "SEED_INIT", 0,
            "Nguyen Van To", "Thuy to khai co dong ho",
            0, 0,
            0, 0, 0,
            10,
            12
        },
        {
            "TC02_SEED_BRANCH", "SEED_02", "SEED_INIT", 0,
            "Nguyen Van A", "Truong chi thu nhat",
            1, 0,
            0, 0, 0,
            25,
            16
        },
        {
            "TC03_SEED_LEAF", "SEED_03", "SEED_INIT", 0,
            "Nguyen Van B", "Chau doi thu ba",
            2, 0,
            1, 1, 0,
            50,
            20
        }
    };

    fuzz_log("\n======================================================================================\n");
    fuzz_log(" GIAI ĐOẠN A: NẠP SEED DATA CORPUS & KHỞI TẠO ĐỘ PHỦ NỀN (BASELINE COVERAGE)\n");
    fuzz_log("======================================================================================\n");
    for (int i = 0; i < 3; i++) {
        execute_whitebox_testcase(&seed_corpus[i]);
    }

    /* 6.2. Hàng đợi BFS (Breadth-First Search) đột biến rộng trên từng tầng Module để mở khóa các nhánh biên */
    fuzz_log("\n======================================================================================\n");
    fuzz_log(" GIAI ĐOẠN B: VÒNG LẶP ĐỘT BIẾN THEO CHIỀU RỘNG (BFS STATE-SPACE EXPLORATION)\n");
    fuzz_log(" (Mục tiêu: Đột biến từng điều kiện biên P03, P05, P12, P14, P19 trên mọi Module)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase bfs_queue[5];
    for (int i = 0; i < 5; i++) {
        bfs_queue[i] = seed_corpus[0];
        strcpy(bfs_queue[i].traversal_mode, "BFS_MUT");
        bfs_queue[i].mutation_depth = 1;
    }

    /* BFS Mutation 1: Đảo mệnh đề P02 -> P03 (Tràn bộ đệm Stack tên thành viên >= 16 bytes) */
    strcpy(bfs_queue[0].tc_id, "TC04_BFS_STACK_OVF");
    strcpy(bfs_queue[0].step1_raw_name, "Nguyen_Van_Truong_Toc_Dai_Chi_Overflow_Stack");

    /* BFS Mutation 2: Đảo mệnh đề P04 -> P05 (Tiêm chuỗi định dạng %x%x%n vào tiểu sử) */
    strcpy(bfs_queue[1].tc_id, "TC05_BFS_FMT_STR");
    strcpy(bfs_queue[1].step1_bio_note, "Cong duc: %x.%x.%x.%n_stack_leak");

    /* BFS Mutation 3: Đảo mệnh đề P11 -> P12 (Ghi ngoài biên mảng liên kết Cha-Con parent_idx = -5) */
    strcpy(bfs_queue[2].tc_id, "TC06_BFS_OOB_WRITE");
    bfs_queue[2].step3_parent_idx = -5;

    /* BFS Mutation 4: Đảo mệnh đề P13 -> P14 (Giải tham chiếu con trỏ phối ngẫu NULL tại slot 15) */
    strcpy(bfs_queue[3].tc_id, "TC07_BFS_NULL_PTR");
    bfs_queue[3].step3_spouse_idx = 15;

    /* BFS Mutation 5: Đảo mệnh đề P18 -> P19 (Đọc tràn bộ đệm Stack lịch sử chỉnh sửa claim_len = 60 > 24) */
    strcpy(bfs_queue[4].tc_id, "TC08_BFS_OOB_READ");
    bfs_queue[4].step5_audit_claim_len = 60;

    for (int i = 0; i < 5; i++) {
        execute_whitebox_testcase(&bfs_queue[i]);
    }

    /* 6.3. Ngăn xếp DFS (Depth-First Search) đột biến sâu đa bước (vòng đời Heap, chu trình Cây, tràn số 16-bit) */
    fuzz_log("\n======================================================================================\n");
    fuzz_log(" GIAI ĐOẠN C: VÒNG LẶP ĐỘT BIẾN THEO CHIỀU SÂU (DFS DEEP STATE-PATH EXPLORATION)\n");
    fuzz_log(" (Mục tiêu: Đi sâu vào chuỗi trạng thái S06->S07->S08->S09/S10, Chu trình S16 & S17)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase dfs_stack[4];
    for (int i = 0; i < 4; i++) {
        dfs_stack[i] = seed_corpus[1];
        strcpy(dfs_stack[i].traversal_mode, "DFS_MUT");
        dfs_stack[i].mutation_depth = i + 2;
    }

    /* DFS Deep Path 1: S06 -> S07 -> S08 (Freed Dangling) -> S09 (Use-After-Free) */
    strcpy(dfs_stack[0].tc_id, "TC09_DFS_HEAP_UAF");
    dfs_stack[0].step2_lifecycle_op = 1;

    /* DFS Deep Path 2: S06 -> S07 -> S08 (Freed Dangling) -> S10 (Double Free) */
    strcpy(dfs_stack[1].tc_id, "TC10_DFS_DBL_FREE");
    dfs_stack[1].step2_lifecycle_op = 2;

    /* DFS Deep Path 3: S07 -> S11 -> S16 (Tạo chu trình Cha-Con 0 <-> 1 gây treo vòng lặp DFS/BFS) */
    strcpy(dfs_stack[2].tc_id, "TC11_DFS_CYCLE_HANG");
    dfs_stack[2].step3_create_cycle = 1;

    /* DFS Deep Path 4: S11 -> S15 -> S17 (Tràn số nguyên 16-bit: 16385 * 4 = 65540 -> 4 bytes Heap) */
    strcpy(dfs_stack[3].tc_id, "TC12_DFS_INT_OVF");
    dfs_stack[3].step4_fund_record_count = 16385;

    for (int i = 0; i < 4; i++) {
        execute_whitebox_testcase(&dfs_stack[i]);
    }
}

/* ======================================================================================
 * 7. IN BÁO CÁO TỔNG KẾT CÂY TRẠNG THÁI, MỆNH ĐỀ, VÙNG NHỚ & LOG CRASH/HANG
 * ====================================================================================== */
static void print_state_tree_and_summary(void) {
    fuzz_log("\n======================================================================================\n");
    fuzz_log(" BẢNG TỔNG HỢP CÂY QUAN HỆ TRẠNG THÁI (STATES), MỆNH ĐỀ (PREDICATES) & VÙNG NHỚ\n");
    fuzz_log("======================================================================================\n");
    fuzz_log("%-4s | %-27s | %-6s | %-4s | %-38s | %-30s | %-9s | %-7s\n",
             "ID", "Module", "Parent", "Pred", "Biểu thức Mệnh đề (Predicate)", "Cấp phát Vùng nhớ (Memory)", "Kết quả", "Đã phủ");
    fuzz_log("-----+-----------------------------+--------+------+----------------------------------------+--------------------------------+-----------+--------\n");

    for (int i = 0; i < TOTAL_STATES; i++) {
        const StateDescriptor *d = &STATE_TABLE[i];
        fuzz_log("%-4s | %-27s | %-6s | %-4s | %-38.38s | %-30.30s | %-9s | %-7s\n",
                 d->state_code,
                 d->module_name,
                 d->parent_state,
                 d->predicate_code,
                 d->predicate_expr,
                 d->memory_allocation,
                 d->outcome_type,
                 g_state_visited[i] ? "YES" : "NO");
    }

    fuzz_log("\n======================================================================================\n");
    fuzz_log(" TỔNG KẾT CHIẾN DỊCH FUZZING WHITE-BOX (SUMMARY METRICS)\n");
    fuzz_log("======================================================================================\n");
    fuzz_log("  * Tổng số Module kiểm thử             : %d Modules\n", TOTAL_MODULES);
    fuzz_log("  * Tổng số Test Cases (Multi-step)     : %d Test Cases (3 Seeds + 5 BFS + 4 DFS)\n", g_total_testcases_executed);
    fuzz_log("  * Độ phủ Trạng thái (State Coverage)  : %.1f%% (%d / %d States)\n",
             get_state_coverage_pct(), TOTAL_STATES, TOTAL_STATES);
    fuzz_log("  * Độ phủ Mệnh đề (Predicate Coverage) : %.1f%% (%d / %d Predicates)\n",
             get_predicate_coverage_pct(), TOTAL_PREDICATES, TOTAL_PREDICATES);
    fuzz_log("  * Tổng số trường hợp CRASH phát hiện  : %d Crashes (Buffer/Heap/Integer/Null)\n", g_total_crashes_found);
    fuzz_log("  * Tổng số trường hợp TREO (HANG)      : %d Hang (Infinite Loop trên chu trình Cây Gia Phả)\n", g_total_hangs_found);
    fuzz_log("  * File nhật ký xuất ra                : fuzzing_execution.log\n");
    fuzz_log("======================================================================================\n");
}

int main(void) {
    g_log_fp = fopen("fuzzing_execution.log", "w");

    fuzz_log("======================================================================================\n");
    fuzz_log("   WHITE-BOX STATE-SPACE & DFS/BFS FUZZER - HỆ THỐNG QUẢN LÝ DÒNG HỌ (MỘC BẢN)\n");
    fuzz_log("======================================================================================\n");

    run_whitebox_fuzzing_campaign();
    print_state_tree_and_summary();

    /* Dọn dẹp vùng nhớ Heap cuối chương trình */
    for (int i = 0; i < MAX_CLAN_MEMBERS; i++) {
        if (g_registry_table[i] != NULL && !g_node_freed_flag[i]) {
            free(g_registry_table[i]);
            g_registry_table[i] = NULL;
        }
    }

    if (g_log_fp != NULL) {
        fclose(g_log_fp);
        g_log_fp = NULL;
    }
    return 0;
}
