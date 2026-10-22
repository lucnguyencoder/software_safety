#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdarg.h>

#define MODULE_NAME       "Module_Clan_Genealogy_Engine"
#define TOTAL_STATES      16
#define TOTAL_PREDICATES  16
#define TOTAL_PATHS       10
#define MAX_CLAN_MEMBERS  16
#define MAX_DFS_BFS_STEPS 32
#define MAX_TRACE_LEN     8

typedef enum {
    S00_MODULE_INIT = 0,
    // Step 1: Các trạng thái bóc tách chuỗi đầu vào trên Stack
    S01_ERR_NAME_STACK_OVF,
    S02_ERR_BIO_FMT_STRING,
    S03_INPUT_PARSED_OK,
    // Step 2: Các trạng thái cấp phát Heap và vòng đời con trỏ
    S04_HEAP_NODE_ACTIVE,
    S05_HEAP_DANGLING_PTR,
    S06_ERR_HEAP_UAF,
    S07_ERR_HEAP_DOUBLE_FREE,
    // Step 3: Các trạng thái liên kết quan hệ Cha-Con và Vợ-Chồng
    S08_ERR_PARENT_OOB_WRITE,
    S09_ERR_SPOUSE_NULL_DEREF,
    S10_RELATIONS_LINKED_OK,
    // Step 4: Các trạng thái duyệt cây DFS/BFS và tính quỹ dòng họ
    S11_ERR_DFS_BFS_CYCLE_HANG,
    S12_ERR_FUND_INT_OVERFLOW,
    S13_HIERARCHY_CALC_OK,
    // Step 5: Các trạng thái đối chiếu lịch sử chỉnh sửa (Audit Diff)
    S14_ERR_AUDIT_OOB_READ,
    S15_AUDIT_COMMITTED_OK
} SystemStateID;

typedef struct {
    SystemStateID id;
    const char *state_code;
    const char *state_name;
    const char *step_stage;
    const char *parent_state;
    const char *predicate_code;
    const char *predicate_expr;
    const char *memory_allocation;
    const char *outcome_type;
    const char *cwe_id;
} StateDescriptor;

static const StateDescriptor STATE_TABLE[TOTAL_STATES] = {
    {S00_MODULE_INIT,            "S00", "S00_MODULE_INIT",            "Step 0: Entry",      "ROOT", "P00", "request_packet != NULL",                              "Stack Frame Init (0 bytes)",            "NORMAL",    "N/A"},
    {S01_ERR_NAME_STACK_OVF,     "S01", "S01_ERR_NAME_STACK_OVF",     "Step 1: Parser",     "S00",  "P01", "strlen(raw_name) >= 16",                              "Stack Buffer: char name_buf[16] OVF",   "CRASH_BUF", "CWE-121"},
    {S02_ERR_BIO_FMT_STRING,     "S02", "S02_ERR_BIO_FMT_STRING",     "Step 1: Parser",     "S00",  "P02", "strlen(name) < 16 && strstr(bio, \"%x/%n\")",         "Stack Buffer: char bio_buf[64] Tainted","CRASH_BUF", "CWE-134"},
    {S03_INPUT_PARSED_OK,        "S03", "S03_INPUT_PARSED_OK",        "Step 1: Parser",     "S00",  "P03", "strlen(name) < 16 && strchr(bio, '%') == NULL",       "Stack Buffers: name[16] + bio[64] OK",  "NORMAL",    "N/A"},
    {S04_HEAP_NODE_ACTIVE,       "S04", "S04_HEAP_NODE_ACTIVE",       "Step 2: Heap Alloc", "S03",  "P04", "lifecycle_op == 0 && malloc(sizeof(ClanMember))",     "Heap Chunk: 64 bytes (Allocated)",      "NORMAL",    "N/A"},
    {S05_HEAP_DANGLING_PTR,      "S05", "S05_HEAP_DANGLING_PTR",      "Step 2: Heap Alloc", "S03",  "P05", "lifecycle_op > 0 && free(node) without NULLing",      "Heap Chunk: 64B Freed (Dangling Ptr)",  "NORMAL",    "N/A"},
    {S06_ERR_HEAP_UAF,           "S06", "S06_ERR_HEAP_UAF",           "Step 2: Heap Alloc", "S05",  "P06", "lifecycle_op == 1 (Write to freed Dangling Ptr)",     "Heap Freed Chunk: 64B Write UAF",       "CRASH_MEM", "CWE-416"},
    {S07_ERR_HEAP_DOUBLE_FREE,   "S07", "S07_ERR_HEAP_DOUBLE_FREE",   "Step 2: Heap Alloc", "S05",  "P07", "lifecycle_op == 2 (Second free on Dangling Ptr)",     "Heap Freed Chunk: Duplicate free()",    "CRASH_MEM", "CWE-415"},
    {S08_ERR_PARENT_OOB_WRITE,   "S08", "S08_ERR_PARENT_OOB_WRITE",   "Step 3: Linker",     "S04",  "P08", "parent_idx < 0 || parent_idx >= 16",                  "BSS Table OOB: g_table[parent_idx]",    "CRASH_MEM", "CWE-787"},
    {S09_ERR_SPOUSE_NULL_DEREF,  "S09", "S09_ERR_SPOUSE_NULL_DEREF",  "Step 3: Linker",     "S04",  "P09", "0 <= parent_idx < 16 && g_table[spouse_idx] == NULL", "NULL Pointer Deref (0x00000000)",       "CRASH_MEM", "CWE-476"},
    {S10_RELATIONS_LINKED_OK,    "S10", "S10_RELATIONS_LINKED_OK",    "Step 3: Linker",     "S04",  "P10", "0 <= parent_idx < 16 && g_table[spouse_idx] != NULL", "BSS Table[16] + Heap Spouse Ref OK",    "NORMAL",    "N/A"},
    {S11_ERR_DFS_BFS_CYCLE_HANG, "S11", "S11_ERR_DFS_BFS_CYCLE_HANG", "Step 4: DFS/BFS",    "S10",  "P11", "dfs_steps > 32 || bfs_steps > 32 (Cycle 0 <-> 1)",    "Stack DFS + Queue BFS[64] Exhaustion",  "HANG",      "CWE-674"},
    {S12_ERR_FUND_INT_OVERFLOW,  "S12", "S12_ERR_FUND_INT_OVERFLOW",  "Step 4: DFS/BFS",    "S10",  "P12", "acyclic && (uint16_t)(fund_count * 4) < fund_count",  "Heap Buffer: Undersized malloc(4B)",    "CRASH_INT", "CWE-190"},
    {S13_HIERARCHY_CALC_OK,      "S13", "S13_HIERARCHY_CALC_OK",      "Step 4: DFS/BFS",    "S10",  "P13", "dfs_steps <= 32 && bfs_steps <= 32 && fund_ok",       "Queue BFS[64] + Heap Fund Buffer OK",   "NORMAL",    "N/A"},
    {S14_ERR_AUDIT_OOB_READ,     "S14", "S14_ERR_AUDIT_OOB_READ",     "Step 5: Audit Diff", "S13",  "P14", "audit_claim_len > 24 (Reads past old_bio[24])",       "Stack Over-read: 60B from 24B Buffer",  "CRASH_BUF", "CWE-125"},
    {S15_AUDIT_COMMITTED_OK,     "S15", "S15_AUDIT_COMMITTED_OK",     "Step 5: Audit Diff", "S13",  "P15", "audit_claim_len <= 24",                               "Stack Buffer: old_bio_buf[24] Aligned", "NORMAL",    "N/A"}
};

typedef struct {
    const char *path_id;
    const char *path_name;
    const char *state_sequence;
    SystemStateID terminal_state;
    const char *path_type;
} ExecutionPathDescriptor;

static const ExecutionPathDescriptor PATH_TABLE[TOTAL_PATHS] = {
    {"PATH_01", "Full_Normal_Commit_Path",     "S00 -> S03 -> S04 -> S10 -> S13 -> S15", S15_AUDIT_COMMITTED_OK,     "NORMAL_PATH"},
    {"PATH_02", "Name_Stack_Overflow_Path",    "S00 -> S01",                             S01_ERR_NAME_STACK_OVF,     "CRASH_PATH (CWE-121)"},
    {"PATH_03", "Bio_Format_String_Path",      "S00 -> S02",                             S02_ERR_BIO_FMT_STRING,     "CRASH_PATH (CWE-134)"},
    {"PATH_04", "Parent_OOB_Write_Path",       "S00 -> S03 -> S04 -> S08",               S08_ERR_PARENT_OOB_WRITE,   "CRASH_PATH (CWE-787)"},
    {"PATH_05", "Spouse_Null_Deref_Path",      "S00 -> S03 -> S04 -> S09",               S09_ERR_SPOUSE_NULL_DEREF,  "CRASH_PATH (CWE-476)"},
    {"PATH_06", "Fund_Int_Overflow_Path",      "S00 -> S03 -> S04 -> S10 -> S12",        S12_ERR_FUND_INT_OVERFLOW,  "CRASH_PATH (CWE-190)"},
    {"PATH_07", "Audit_OOB_Read_Path",         "S00 -> S03 -> S04 -> S10 -> S13 -> S14", S14_ERR_AUDIT_OOB_READ,     "CRASH_PATH (CWE-125)"},
    {"PATH_08", "Heap_Use_After_Free_Path",    "S00 -> S03 -> S05 -> S06",               S06_ERR_HEAP_UAF,           "CRASH_PATH (CWE-416)"},
    {"PATH_09", "Heap_Double_Free_Path",       "S00 -> S03 -> S05 -> S07",               S07_ERR_HEAP_DOUBLE_FREE,   "CRASH_PATH (CWE-415)"},
    {"PATH_10", "Hierarchy_Cycle_Hang_Path",   "S00 -> S03 -> S04 -> S10 -> S11",        S11_ERR_DFS_BFS_CYCLE_HANG, "HANG_PATH  (CWE-674)"}
};

typedef struct ClanMember {
    int id;
    char full_name[16];
    char bio_note[32];
    int generation;
    int parent_id;
    struct ClanMember *spouse_ptr;
} ClanMember;

static ClanMember *g_member_table[MAX_CLAN_MEMBERS];
static int g_parent_map[MAX_CLAN_MEMBERS];

typedef struct {
    char tc_id[24];
    char seed_origin[16];
    char search_strategy[12];
    int  mutation_depth;

    char step1_raw_name[48];
    char step1_bio_note[48];
    int  step2_slot_id;
    int  step2_lifecycle_op;
    int  step3_parent_idx;
    int  step3_spouse_idx;
    int  step3_create_cycle;
    uint16_t step4_fund_count;
    int  step5_audit_claim_len;
} FuzzTestCase;

static int g_state_visited[TOTAL_STATES];
static int g_predicate_visited[TOTAL_PREDICATES];
static int g_path_visited[TOTAL_PATHS];

static SystemStateID g_current_trace[MAX_TRACE_LEN];
static int g_current_trace_len = 0;
static int g_new_states_this_tc = 0;
static int g_new_paths_this_tc = 0;
static int g_total_tc_run = 0;
static int g_total_crashes = 0;
static int g_total_hangs = 0;

static void fuzz_log(const char *fmt, ...) {
    va_list a1;
    va_start(a1, fmt);
    vprintf(fmt, a1);
    va_end(a1);
}

// Ghi nhận chuyển trạng thái, cập nhật độ phủ mệnh đề và phát hiện Crash/Hang
static void enter_state(SystemStateID state_id, int pred_id, const FuzzTestCase *tc) {
    if (g_current_trace_len < MAX_TRACE_LEN) {
        g_current_trace[g_current_trace_len++] = state_id;
    }

    int is_new = 0;
    if (!g_state_visited[state_id]) {
        g_state_visited[state_id] = 1;
        g_new_states_this_tc++;
        is_new = 1;
    }
    if (pred_id >= 0 && pred_id < TOTAL_PREDICATES) {
        g_predicate_visited[pred_id] = 1;
    }

    const StateDescriptor *d = &STATE_TABLE[state_id];
    fuzz_log("      -> [STATE TRANSITION] %s -> %s (%s) | Pred %s: (%s) | Mem: [%s]%s\n",
             d->parent_state, d->state_code, d->state_name,
             d->predicate_code, d->predicate_expr, d->memory_allocation,
             is_new ? " [NEW STATE!]" : "");

    if (strncmp(d->outcome_type, "CRASH", 5) == 0) {
        g_total_crashes++;
        fuzz_log("      [!] >>> CRASH DETECTED [%s | %s] at %s (%s) | TC: %s <<<\n",
                 d->outcome_type, d->cwe_id, d->state_code, d->state_name, tc->tc_id);
    } else if (strcmp(d->outcome_type, "HANG") == 0) {
        g_total_hangs++;
        fuzz_log("      [!] >>> HANG / INFINITE LOOP DETECTED [%s | %s] at %s (%s) | TC: %s <<<\n",
                 d->outcome_type, d->cwe_id, d->state_code, d->state_name, tc->tc_id);
    }
}

// Đối chiếu chuỗi trạng thái hiện tại với PATH_TABLE để cập nhật Path Coverage
static void record_execution_path(void) {
    if (g_current_trace_len == 0) return;
    SystemStateID terminal = g_current_trace[g_current_trace_len - 1];

    char trace_buf[128] = "";
    for (int i = 0; i < g_current_trace_len; i++) {
        strcat(trace_buf, STATE_TABLE[g_current_trace[i]].state_code);
        if (i + 1 < g_current_trace_len) strcat(trace_buf, " -> ");
    }

    for (int p = 0; p < TOTAL_PATHS; p++) {
        if (PATH_TABLE[p].terminal_state == terminal) {
            int is_new_path = 0;
            if (!g_path_visited[p]) {
                g_path_visited[p] = 1;
                g_new_paths_this_tc++;
                is_new_path = 1;
            }
            fuzz_log("      => [PATH COVERAGE TRACE] %s | Matched: %s (%s)%s\n",
                     trace_buf, PATH_TABLE[p].path_id, PATH_TABLE[p].path_name,
                     is_new_path ? " [NEW PATH DISCOVERED!]" : "");
            break;
        }
    }
}

static double calc_pct(const int *arr, int total) {
    int c = 0;
    for (int i = 0; i < total; i++) {
        if (arr[i]) c++;
    }
    return ((double)c * 100.0) / (double)total;
}

static int count_visited(const int *arr, int total) {
    int c = 0;
    for (int i = 0; i < total; i++) {
        if (arr[i]) c++;
    }
    return c;
}

// Duyệt ngược cây gia phả theo chiều sâu (DFS); trả về -1 nếu lặp vô hạn do chu trình
static int traverse_depth_dfs(int start_node, int *out_steps) {
    int curr = start_node;
    int steps = 0;
    while (curr != -1 && steps <= MAX_DFS_BFS_STEPS) {
        steps++;
        curr = g_parent_map[curr];
    }
    *out_steps = steps;
    return (steps > MAX_DFS_BFS_STEPS) ? -1 : steps;
}

// Duyệt xuôi các đời con cháu theo chiều rộng (BFS); trả về -1 nếu bị treo vòng lặp
static int traverse_children_bfs(int root_node, int *out_steps) {
    int queue[MAX_DFS_BFS_STEPS * 2];
    int head = 0, tail = 0, steps = 0;

    queue[tail++] = root_node;
    while (head < tail && steps <= MAX_DFS_BFS_STEPS) {
        int u = queue[head++];
        steps++;
        for (int v = 0; v < 4; v++) {
            if (g_parent_map[v] == u && tail < (int)(sizeof(queue) / sizeof(queue[0]))) {
                queue[tail++] = v;
            }
        }
    }
    *out_steps = steps;
    return (steps > MAX_DFS_BFS_STEPS) ? -1 : steps;
}

// Module trung tâm thực thi quy trình 5 bước xử lý hồ sơ gia phả
static void execute_clan_genealogy_module(const FuzzTestCase *tc) {
    char name_buf[16];
    char bio_buf[64];
    char old_bio_buf[24] = "Gia pha Moc Ban goc";
    char diff_preview[64];

    g_total_tc_run++;
    g_current_trace_len = 0;
    g_new_states_this_tc = 0;
    g_new_paths_this_tc = 0;

    fuzz_log("\n--------------------------------------------------------------------------------------\n");
    fuzz_log("[TEST CASE #%02d] ID: %-20s | Seed: %-8s | Strategy: %-8s | Depth: %d\n",
             g_total_tc_run, tc->tc_id, tc->seed_origin, tc->search_strategy, tc->mutation_depth);
    fuzz_log("  -> [5-STEP MODULE PROCESS INPUT]:\n");
    fuzz_log("     Step 1 (Input Parse) : raw_name=\"%s\" (len=%zu), bio=\"%s\"\n",
             tc->step1_raw_name, strlen(tc->step1_raw_name), tc->step1_bio_note);
    fuzz_log("     Step 2 (Heap Node)   : slot_id=%d, lifecycle_op=%d (0:Alloc, 1:UAF, 2:DoubleFree)\n",
             tc->step2_slot_id, tc->step2_lifecycle_op);
    fuzz_log("     Step 3 (Tree Linker) : parent_idx=%d, spouse_idx=%d, create_cycle=%d\n",
             tc->step3_parent_idx, tc->step3_spouse_idx, tc->step3_create_cycle);
    fuzz_log("     Step 4 (DFS/BFS/Fund): DFS & BFS Tree Traversal + fund_count=%u\n",
             (unsigned int)tc->step4_fund_count);
    fuzz_log("     Step 5 (Audit Diff)  : audit_claim_len=%d bytes (old_bio_buf=24B)\n",
             tc->step5_audit_claim_len);

    enter_state(S00_MODULE_INIT, 0, tc);

    // Step 1: Kiểm tra bộ đệm đầu vào (Stack Buffer Overflow & Format String)
    if (strlen(tc->step1_raw_name) >= sizeof(name_buf)) {
        memcpy(name_buf, tc->step1_raw_name, sizeof(name_buf) - 1);
        name_buf[sizeof(name_buf) - 1] = '\0';
        enter_state(S01_ERR_NAME_STACK_OVF, 1, tc);
        goto finalize_path;
    }

    if (strstr(tc->step1_bio_note, "%x") != NULL || strstr(tc->step1_bio_note, "%n") != NULL) {
        snprintf(bio_buf, sizeof(bio_buf), "%s", tc->step1_bio_note);
        enter_state(S02_ERR_BIO_FMT_STRING, 2, tc);
        goto finalize_path;
    }

    memcpy(name_buf, tc->step1_raw_name, strlen(tc->step1_raw_name) + 1);
    snprintf(bio_buf, sizeof(bio_buf), "%s", tc->step1_bio_note);
    enter_state(S03_INPUT_PARSED_OK, 3, tc);

    // Step 2: Cấp phát nút Heap và kiểm tra lỗi Dangling Pointer / UAF / Double Free
    int slot = (tc->step2_slot_id >= 0 && tc->step2_slot_id < MAX_CLAN_MEMBERS) ? tc->step2_slot_id : 0;
    if (g_member_table[slot] == NULL) {
        g_member_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_member_table[slot], 0, sizeof(ClanMember));
        g_member_table[slot]->id = slot;
    }

    if (tc->step2_lifecycle_op > 0) {
        free(g_member_table[slot]);
        // Giải phóng vùng nhớ nhưng không gán NULL, tạo trạng thái trung gian Dangling Pointer S05
        enter_state(S05_HEAP_DANGLING_PTR, 5, tc);

        if (tc->step2_lifecycle_op == 1) {
            enter_state(S06_ERR_HEAP_UAF, 6, tc);
        } else {
            enter_state(S07_ERR_HEAP_DOUBLE_FREE, 7, tc);
        }

        g_member_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_member_table[slot], 0, sizeof(ClanMember));
        goto finalize_path;
    }

    enter_state(S04_HEAP_NODE_ACTIVE, 4, tc);

    // Step 3: Kiểm tra biên mảng cha-con (OOB Write) và con trỏ phối ngẫu (NULL Dereference)
    if (tc->step3_parent_idx < 0 || tc->step3_parent_idx >= MAX_CLAN_MEMBERS) {
        enter_state(S08_ERR_PARENT_OOB_WRITE, 8, tc);
        goto finalize_path;
    }

    if (tc->step3_spouse_idx == 15 && g_member_table[15] == NULL) {
        enter_state(S09_ERR_SPOUSE_NULL_DEREF, 9, tc);
        goto finalize_path;
    }

    enter_state(S10_RELATIONS_LINKED_OK, 10, tc);

    // Step 4: Duyệt cây gia phả bằng DFS/BFS (kiểm tra treo chu trình) và tính quỹ (tràn số 16-bit)
    g_parent_map[0] = -1;
    g_parent_map[1] = 0;
    g_parent_map[2] = 1;
    g_parent_map[3] = 2;

    if (tc->step3_create_cycle) {
        g_parent_map[0] = 1;
        g_parent_map[1] = 0;
    }

    int dfs_steps = 0, bfs_steps = 0;
    int dfs_res = traverse_depth_dfs(3, &dfs_steps);
    int bfs_res = traverse_children_bfs(0, &bfs_steps);

    fuzz_log("      [DFS/BFS TREE TRAVERSAL] DFS_Steps=%d | BFS_Steps=%d | Cycle_Flag=%d\n",
             dfs_steps, bfs_steps, tc->step3_create_cycle);

    if (dfs_res == -1 || bfs_res == -1) {
        enter_state(S11_ERR_DFS_BFS_CYCLE_HANG, 11, tc);
        goto finalize_path;
    }

    uint16_t alloc_bytes = (uint16_t)(tc->step4_fund_count * sizeof(uint32_t));
    if (tc->step4_fund_count > 16384 && alloc_bytes < tc->step4_fund_count) {
        enter_state(S12_ERR_FUND_INT_OVERFLOW, 12, tc);
        goto finalize_path;
    }

    enter_state(S13_HIERARCHY_CALC_OK, 13, tc);

    // Step 5: Đối chiếu lịch sử chỉnh sửa và kiểm tra lỗi đọc tràn bộ đệm Stack (OOB Read)
    memset(diff_preview, 0, sizeof(diff_preview));
    if (tc->step5_audit_claim_len > (int)sizeof(old_bio_buf)) {
        enter_state(S14_ERR_AUDIT_OOB_READ, 14, tc);
        goto finalize_path;
    }

    memcpy(diff_preview, old_bio_buf, (size_t)tc->step5_audit_claim_len);
    enter_state(S15_AUDIT_COMMITTED_OK, 15, tc);

finalize_path:
    record_execution_path();
    fuzz_log("  -> [COVERAGE METRICS AFTER TC #%02d]:\n", g_total_tc_run);
    fuzz_log("     New_States=%d | State_Coverage=%.1f%% (%d/%d) | Predicate_Coverage=%.1f%% (%d/%d) | Path_Coverage=%.1f%% (%d/%d)\n",
             g_new_states_this_tc,
             calc_pct(g_state_visited, TOTAL_STATES), count_visited(g_state_visited, TOTAL_STATES), TOTAL_STATES,
             calc_pct(g_predicate_visited, TOTAL_PREDICATES), count_visited(g_predicate_visited, TOTAL_PREDICATES), TOTAL_PREDICATES,
             calc_pct(g_path_visited, TOTAL_PATHS), count_visited(g_path_visited, TOTAL_PATHS), TOTAL_PATHS);
}

static void run_whitebox_fuzzing_campaign(void) {
    // Giai đoạn A: Khởi tạo tập dữ liệu hạt giống (Seed Corpus) để mở đường đi chuẩn PATH_01
    FuzzTestCase seeds[2] = {
        {
            "TC01_SEED_ROOT", "SEED_01", "SEED_INIT", 0,
            "Nguyen Van To", "Thuy to khai co dong ho",
            0, 0,
            0, 0, 0,
            10, 12
        },
        {
            "TC02_SEED_BRANCH", "SEED_02", "SEED_INIT", 0,
            "Nguyen Van A", "Truong chi doi thu hai",
            1, 0,
            0, 0, 0,
            25, 18
        }
    };

    fuzz_log("\n======================================================================================\n");
    fuzz_log(" PHASE A: SEED DATA CORPUS INITIALIZATION (PATH_01)\n");
    fuzz_log("======================================================================================\n");
    for (int i = 0; i < 2; i++) {
        execute_clan_genealogy_module(&seeds[i]);
    }

    // Giai đoạn B: Hàng đợi BFS đột biến điều kiện biên tại từng bước (mở khóa PATH_02 .. PATH_07)
    fuzz_log("\n======================================================================================\n");
    fuzz_log(" PHASE B: BFS STATE-SPACE EXPLORATION (PATH_02 .. PATH_07)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase bfs_queue[6];
    for (int i = 0; i < 6; i++) {
        bfs_queue[i] = seeds[0];
        strcpy(bfs_queue[i].search_strategy, "BFS_QUEUE");
        bfs_queue[i].mutation_depth = 1;
    }

    strcpy(bfs_queue[0].tc_id, "TC03_BFS_NAME_OVF");
    strcpy(bfs_queue[0].step1_raw_name, "Nguyen_Van_Truong_Toc_Dai_Chi_Stack_Overflow");

    strcpy(bfs_queue[1].tc_id, "TC04_BFS_FMT_STR");
    strcpy(bfs_queue[1].step1_bio_note, "Tieu su: %x.%x.%x.%n_stack_corrupt");

    strcpy(bfs_queue[2].tc_id, "TC05_BFS_OOB_WRITE");
    bfs_queue[2].step3_parent_idx = -5;

    strcpy(bfs_queue[3].tc_id, "TC06_BFS_NULL_DEREF");
    bfs_queue[3].step3_spouse_idx = 15;

    strcpy(bfs_queue[4].tc_id, "TC07_BFS_INT_OVF");
    bfs_queue[4].step4_fund_count = 16385;

    strcpy(bfs_queue[5].tc_id, "TC08_BFS_OOB_READ");
    bfs_queue[5].step5_audit_claim_len = 60;

    for (int i = 0; i < 6; i++) {
        execute_clan_genealogy_module(&bfs_queue[i]);
    }

    // Giai đoạn C: Ngăn xếp DFS đi sâu vào trạng thái trung gian và chu trình đồ thị (PATH_08 .. PATH_10)
    fuzz_log("\n======================================================================================\n");
    fuzz_log(" PHASE C: DFS DEEP STATE-PATH EXPLORATION (PATH_08 .. PATH_10)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase dfs_stack[3];
    for (int i = 0; i < 3; i++) {
        dfs_stack[i] = seeds[1];
        strcpy(dfs_stack[i].search_strategy, "DFS_STACK");
        dfs_stack[i].mutation_depth = i + 2;
    }

    strcpy(dfs_stack[0].tc_id, "TC09_DFS_HEAP_UAF");
    dfs_stack[0].step2_lifecycle_op = 1;

    strcpy(dfs_stack[1].tc_id, "TC10_DFS_DOUBLE_FREE");
    dfs_stack[1].step2_lifecycle_op = 2;

    strcpy(dfs_stack[2].tc_id, "TC11_DFS_CYCLE_HANG");
    dfs_stack[2].step3_create_cycle = 1;

    for (int i = 0; i < 3; i++) {
        execute_clan_genealogy_module(&dfs_stack[i]);
    }
}

static void print_final_summary(void) {
    fuzz_log("\n========================================================================================================================================\n");
    fuzz_log(" TABLE 1: STATE-SPACE TREE (16 STATES), PREDICATE EXPRESSIONS & MEMORY ALLOCATIONS (Module: %s)\n", MODULE_NAME);
    fuzz_log("========================================================================================================================================\n");
    fuzz_log("%-4s | %-18s | %-6s | %-4s | %-52s | %-40s | %-9s | %-7s | %-7s\n",
             "ID", "Process Step", "Parent", "Pred", "Predicate Expression", "Memory Allocation", "Outcome", "CWE ID", "Covered");
    fuzz_log("-----+--------------------+--------+------+------------------------------------------------------+------------------------------------------+-----------+---------+--------\n");

    for (int i = 0; i < TOTAL_STATES; i++) {
        const StateDescriptor *d = &STATE_TABLE[i];
        fuzz_log("%-4s | %-18s | %-6s | %-4s | %-52s | %-40s | %-9s | %-7s | %-7s\n",
                 d->state_code, d->step_stage, d->parent_state, d->predicate_code,
                 d->predicate_expr, d->memory_allocation, d->outcome_type, d->cwe_id,
                 g_state_visited[i] ? "YES" : "NO");
    }

    fuzz_log("\n========================================================================================================================================\n");
    fuzz_log(" TABLE 2: EXECUTION PATH COVERAGE REPORT (PATH COVERAGE = 10/10 PATHS)\n");
    fuzz_log("========================================================================================================================================\n");
    fuzz_log("%-7s | %-28s | %-40s | %-22s | %-7s\n",
             "Path ID", "Path Name", "Full State Sequence", "Path Outcome", "Covered");
    fuzz_log("--------+------------------------------+------------------------------------------+------------------------+--------\n");

    for (int p = 0; p < TOTAL_PATHS; p++) {
        const ExecutionPathDescriptor *pt = &PATH_TABLE[p];
        fuzz_log("%-7s | %-28s | %-40s | %-22s | %-7s\n",
                 pt->path_id, pt->path_name, pt->state_sequence, pt->path_type,
                 g_path_visited[p] ? "YES" : "NO");
    }

    fuzz_log("\n========================================================================================================================================\n");
    fuzz_log(" FINAL WHITE-BOX FUZZING SUMMARY (SINGLE MODULE: %s)\n", MODULE_NAME);
    fuzz_log("========================================================================================================================================\n");
    fuzz_log("  * Target Module                        : %s\n", MODULE_NAME);
    fuzz_log("  * Total Test Cases Executed            : %d Test Cases (2 Seeds + 6 BFS + 3 DFS)\n", g_total_tc_run);
    fuzz_log("  * State Coverage                       : %.1f%% (%d / %d States)\n",
             calc_pct(g_state_visited, TOTAL_STATES), count_visited(g_state_visited, TOTAL_STATES), TOTAL_STATES);
    fuzz_log("  * Predicate Coverage                   : %.1f%% (%d / %d Predicates)\n",
             calc_pct(g_predicate_visited, TOTAL_PREDICATES), count_visited(g_predicate_visited, TOTAL_PREDICATES), TOTAL_PREDICATES);
    fuzz_log("  * Path Coverage                        : %.1f%% (%d / %d Execution Paths)\n",
             calc_pct(g_path_visited, TOTAL_PATHS), count_visited(g_path_visited, TOTAL_PATHS), TOTAL_PATHS);
    fuzz_log("  * Total Crashes Detected               : %d Crashes (Stack/Heap/OOB/Null/Int)\n", g_total_crashes);
    fuzz_log("  * Total Hangs Detected                 : %d Hang (Infinite Loop DFS/BFS Cycle)\n", g_total_hangs);
    fuzz_log("========================================================================================================================================\n");
}

int main(void) {
    fuzz_log("======================================================================================\n");
    fuzz_log("   WHITE-BOX STATE-SPACE & PATH-COVERAGE FUZZER (1 MODULE: %s)\n", MODULE_NAME);
    fuzz_log("======================================================================================\n");

    run_whitebox_fuzzing_campaign();
    print_final_summary();

    for (int i = 0; i < MAX_CLAN_MEMBERS; i++) {
        if (g_member_table[i] != NULL) {
            free(g_member_table[i]);
            g_member_table[i] = NULL;
        }
    }

    return 0;
}
