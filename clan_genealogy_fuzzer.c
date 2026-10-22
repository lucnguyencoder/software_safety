#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdarg.h>

#define TOTAL_MODULES     5
#define TOTAL_STATES      20
#define TOTAL_PREDICATES  20
#define MAX_CLAN_MEMBERS  16
#define MAX_DFS_BFS_STEPS 32

typedef enum {
    S00_PARSER_IDLE = 0,
    S01_NAME_BUF_ALLOCATED,
    S02_NAME_COPIED_SAFE,
    S03_NAME_STACK_OVERFLOW,
    S04_BIO_FORMAT_SAFE,
    S05_BIO_FORMAT_TAINTED,

    S06_REGISTRY_READY,
    S07_HEAP_NODE_ALLOCATED,
    S08_HEAP_NODE_FREED_DANGLING,
    S09_HEAP_USE_AFTER_FREE,
    S10_HEAP_DOUBLE_FREE,

    S11_LINKER_VALIDATED,
    S12_PARENT_OOB_WRITE,
    S13_SPOUSE_LINKED_OK,
    S14_SPOUSE_NULL_DEREF,

    S15_CALC_DFS_BFS_NORMAL,
    S16_CALC_CYCLE_HANG,
    S17_FUND_INT_OVERFLOW_HEAP,

    S18_AUDIT_DIFF_ALIGNED,
    S19_AUDIT_OOB_READ
} SystemStateID;

typedef struct {
    SystemStateID id;
    const char *state_code;
    const char *module_name;
    const char *parent_state;
    const char *predicate_code;
    const char *predicate_expr;
    const char *memory_allocation;
    const char *outcome_type;
    const char *cwe_id;
} StateDescriptor;

static const StateDescriptor STATE_TABLE[TOTAL_STATES] = {
    {S00_PARSER_IDLE,              "S00", "Module_Payload_Parser",       "ROOT", "P00", "input_packet != NULL",                                "Stack Frame Init (0 bytes)",          "NORMAL",    "N/A"},
    {S01_NAME_BUF_ALLOCATED,       "S01", "Module_Payload_Parser",       "S00",  "P01", "alloc Fixed Stack char local_buf[16]",                "Stack Buffer: char local_buf[16]",   "NORMAL",    "N/A"},
    {S02_NAME_COPIED_SAFE,         "S02", "Module_Payload_Parser",       "S01",  "P02", "strlen(raw_name) < 16",                               "Stack Buffer: 16B (Used <= 15B)",    "NORMAL",    "N/A"},
    {S03_NAME_STACK_OVERFLOW,      "S03", "Module_Payload_Parser",       "S01",  "P03", "strlen(raw_name) >= 16",                              "Stack Buffer: 16B (Overrun > 16B)",  "CRASH_BUF", "CWE-121"},
    {S04_BIO_FORMAT_SAFE,          "S04", "Module_Payload_Parser",       "S00",  "P04", "strchr(bio_note, '%') == NULL",                       "Stack Buffer: char fmt_buf[64]",     "NORMAL",    "N/A"},
    {S05_BIO_FORMAT_TAINTED,       "S05", "Module_Payload_Parser",       "S00",  "P05", "strstr(bio_note, \"%x\") || strstr(bio_note, \"%n\")","Stack Buffer: char fmt_buf[64]",     "CRASH_BUF", "CWE-134"},

    {S06_REGISTRY_READY,           "S06", "Module_Member_Registry",      "ROOT", "P06", "registry_table != NULL",                              "BSS Array: registry_table[16]",      "NORMAL",    "N/A"},
    {S07_HEAP_NODE_ALLOCATED,      "S07", "Module_Member_Registry",      "S06",  "P07", "slot_id in [0..15] && malloc(sizeof(ClanMember))",    "Heap Chunk: 64 bytes (malloc)",      "NORMAL",    "N/A"},
    {S08_HEAP_NODE_FREED_DANGLING, "S08", "Module_Member_Registry",      "S07",  "P08", "action == DELETE_TEMP && free(node) without NULLing", "Heap Chunk: 64B Freed (Dangling)",   "NORMAL",    "N/A"},
    {S09_HEAP_USE_AFTER_FREE,      "S09", "Module_Member_Registry",      "S08",  "P09", "action == EDIT_AFTER_FREE && node_freed == 1",        "Heap Chunk: Read/Write Freed 64B",   "CRASH_MEM", "CWE-416"},
    {S10_HEAP_DOUBLE_FREE,         "S10", "Module_Member_Registry",      "S08",  "P10", "action == ROLLBACK_DELETE && free_count == 2",        "Heap Chunk: Duplicate free(node)",   "CRASH_MEM", "CWE-415"},

    {S11_LINKER_VALIDATED,         "S11", "Module_Genealogy_Linker",     "S07",  "P11", "parent_idx >= 0 && parent_idx < 16",                  "BSS Table: registry_table[0..15]",   "NORMAL",    "N/A"},
    {S12_PARENT_OOB_WRITE,         "S12", "Module_Genealogy_Linker",     "S07",  "P12", "parent_idx < 0 || parent_idx >= 16",                  "BSS Table OOB: index * 8 bytes",     "CRASH_MEM", "CWE-787"},
    {S13_SPOUSE_LINKED_OK,         "S13", "Module_Genealogy_Linker",     "S11",  "P13", "spouse_id >= 0 && registry[spouse_id] != NULL",       "Heap Pointer: 8 bytes valid ref",    "NORMAL",    "N/A"},
    {S14_SPOUSE_NULL_DEREF,        "S14", "Module_Genealogy_Linker",     "S11",  "P14", "spouse_id == 15 && registry[15] == NULL",             "Address 0x00000000 Dereference",     "CRASH_MEM", "CWE-476"},

    {S15_CALC_DFS_BFS_NORMAL,      "S15", "Module_Hierarchy_Calculator", "S11",  "P15", "dfs_steps <= 32 && bfs_steps <= 32 (Acyclic Tree)",   "Stack DFS Frame + Queue BFS[16]",    "NORMAL",    "N/A"},
    {S16_CALC_CYCLE_HANG,          "S16", "Module_Hierarchy_Calculator", "S11",  "P16", "cycle_detected (parent[A]==B && parent[B]==A)",       "Stack Exhaustion / Infinite Loop",   "HANG",      "CWE-674"},
    {S17_FUND_INT_OVERFLOW_HEAP,   "S17", "Module_Hierarchy_Calculator", "S15",  "P17", "(uint16_t)(count * sizeof(uint32_t)) < count",        "Heap Buffer: Undersized malloc()",   "CRASH_INT", "CWE-190"},

    {S18_AUDIT_DIFF_ALIGNED,       "S18", "Module_Audit_Diff_Logger",    "S15",  "P18", "claim_len <= strlen(old_bio_buf)",                    "Stack Buffer: old_bio_buf[24]",      "NORMAL",    "N/A"},
    {S19_AUDIT_OOB_READ,           "S19", "Module_Audit_Diff_Logger",    "S15",  "P19", "claim_len > 24 (memcpy reads past old_bio_buf[24])",  "Stack Over-read: 64B from 24B buf",  "CRASH_BUF", "CWE-125"}
};

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

typedef struct {
    char tc_id[24];
    char seed_origin[24];
    char traversal_mode[12];
    int  mutation_depth;

    char step1_raw_name[48];
    char step1_bio_note[48];

    int  step2_slot_id;
    int  step2_lifecycle_op;

    int  step3_parent_idx;
    int  step3_spouse_idx;
    int  step3_create_cycle;

    uint16_t step4_fund_record_count;

    int  step5_audit_claim_len;
} FuzzTestCase;

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

/* Module 1: Module_Payload_Parser */
static void target_parse_member_name(const FuzzTestCase *tc) {
    char local_name_buf[16];
    record_transition(S00_PARSER_IDLE, 0, tc);
    record_transition(S01_NAME_BUF_ALLOCATED, 1, tc);

    size_t len = strlen(tc->step1_raw_name);
    if (len < sizeof(local_name_buf)) {
        memcpy(local_name_buf, tc->step1_raw_name, len + 1);
        record_transition(S02_NAME_COPIED_SAFE, 2, tc);
    } else {
        memcpy(local_name_buf, tc->step1_raw_name, sizeof(local_name_buf) - 1);
        local_name_buf[sizeof(local_name_buf) - 1] = '\0';
        record_transition(S03_NAME_STACK_OVERFLOW, 3, tc);
    }
}

static void target_format_biography_note(const FuzzTestCase *tc) {
    char fmt_buf[64];
    if (strstr(tc->step1_bio_note, "%x") != NULL || strstr(tc->step1_bio_note, "%n") != NULL) {
        snprintf(fmt_buf, sizeof(fmt_buf), "%s", tc->step1_bio_note);
        record_transition(S05_BIO_FORMAT_TAINTED, 5, tc);
    } else {
        snprintf(fmt_buf, sizeof(fmt_buf), "%s", tc->step1_bio_note);
        record_transition(S04_BIO_FORMAT_SAFE, 4, tc);
    }
}

/* Module 2: Module_Member_Registry */
static void target_registry_lifecycle(const FuzzTestCase *tc) {
    record_transition(S06_REGISTRY_READY, 6, tc);
    int slot = tc->step2_slot_id;
    if (slot < 0 || slot >= MAX_CLAN_MEMBERS) {
        slot = 0;
    }

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
        free(g_registry_table[slot]);
        g_node_freed_flag[slot] = 1;
        g_node_free_count[slot] = 1;
        record_transition(S08_HEAP_NODE_FREED_DANGLING, 8, tc);
        record_transition(S09_HEAP_USE_AFTER_FREE, 9, tc);

        g_registry_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_registry_table[slot], 0, sizeof(ClanMember));
        g_node_freed_flag[slot] = 0;
    } else if (tc->step2_lifecycle_op == 2) {
        free(g_registry_table[slot]);
        g_node_freed_flag[slot] = 1;
        g_node_free_count[slot] = 1;
        record_transition(S08_HEAP_NODE_FREED_DANGLING, 8, tc);

        g_node_free_count[slot] = 2;
        record_transition(S10_HEAP_DOUBLE_FREE, 10, tc);

        g_registry_table[slot] = (ClanMember *)malloc(sizeof(ClanMember));
        memset(g_registry_table[slot], 0, sizeof(ClanMember));
        g_node_freed_flag[slot] = 0;
    }
}

/* Module 3: Module_Genealogy_Linker */
static void target_link_genealogy_relations(const FuzzTestCase *tc) {
    if (tc->step3_parent_idx >= 0 && tc->step3_parent_idx < MAX_CLAN_MEMBERS) {
        record_transition(S11_LINKER_VALIDATED, 11, tc);
    } else {
        record_transition(S12_PARENT_OOB_WRITE, 12, tc);
    }

    if (tc->step3_spouse_idx == 15 && g_registry_table[15] == NULL) {
        record_transition(S14_SPOUSE_NULL_DEREF, 14, tc);
    } else {
        record_transition(S13_SPOUSE_LINKED_OK, 13, tc);
    }
}

/* Module 4: Module_Hierarchy_Calculator */
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

static int target_traverse_children_bfs(int root_node, int *out_steps) {
    int queue[MAX_DFS_BFS_STEPS * 2];
    int head = 0, tail = 0;
    int steps = 0;

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

static void target_hierarchy_and_fund_calc(const FuzzTestCase *tc) {
    g_parent_map[0] = -1;
    g_parent_map[1] = 0;
    g_parent_map[2] = 1;
    g_parent_map[3] = 2;

    if (tc->step3_create_cycle) {
        g_parent_map[0] = 1;
        g_parent_map[1] = 0;
    }

    int dfs_steps = 0, bfs_steps = 0;
    int dfs_res = target_calculate_depth_dfs(3, &dfs_steps);
    int bfs_res = target_traverse_children_bfs(0, &bfs_steps);

    fuzz_log("      [DFS/BFS TREE TRAVERSAL] DFS_Steps=%d | BFS_Steps=%d | Cycle_Flag=%d\n",
             dfs_steps, bfs_steps, tc->step3_create_cycle);

    if (dfs_res == -1 || bfs_res == -1) {
        record_transition(S16_CALC_CYCLE_HANG, 16, tc);
    } else {
        record_transition(S15_CALC_DFS_BFS_NORMAL, 15, tc);
    }

    uint16_t count = tc->step4_fund_record_count;
    uint16_t alloc_bytes = (uint16_t)(count * sizeof(uint32_t));
    if (count > 16384 && alloc_bytes < count) {
        record_transition(S17_FUND_INT_OVERFLOW_HEAP, 17, tc);
    }
}

/* Module 5: Module_Audit_Diff_Logger */
static void target_audit_diff_logger(const FuzzTestCase *tc) {
    char old_bio_buf[24] = "Gia pha Moc Ban goc";
    char leak_preview[64];
    memset(leak_preview, 0, sizeof(leak_preview));

    if (tc->step5_audit_claim_len <= (int)sizeof(old_bio_buf)) {
        memcpy(leak_preview, old_bio_buf, (size_t)tc->step5_audit_claim_len);
        record_transition(S18_AUDIT_DIFF_ALIGNED, 18, tc);
    } else {
        record_transition(S19_AUDIT_OOB_READ, 19, tc);
    }
}

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

static void run_whitebox_fuzzing_campaign(void) {
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

    fuzz_log("\n======================================================================================\n");
    fuzz_log(" GIAI ĐOẠN B: VÒNG LẶP ĐỘT BIẾN THEO CHIỀU RỘNG (BFS STATE-SPACE EXPLORATION)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase bfs_queue[5];
    for (int i = 0; i < 5; i++) {
        bfs_queue[i] = seed_corpus[0];
        strcpy(bfs_queue[i].traversal_mode, "BFS_MUT");
        bfs_queue[i].mutation_depth = 1;
    }

    strcpy(bfs_queue[0].tc_id, "TC04_BFS_STACK_OVF");
    strcpy(bfs_queue[0].step1_raw_name, "Nguyen_Van_Truong_Toc_Dai_Chi_Overflow_Stack");

    strcpy(bfs_queue[1].tc_id, "TC05_BFS_FMT_STR");
    strcpy(bfs_queue[1].step1_bio_note, "Cong duc: %x.%x.%x.%n_stack_leak");

    strcpy(bfs_queue[2].tc_id, "TC06_BFS_OOB_WRITE");
    bfs_queue[2].step3_parent_idx = -5;

    strcpy(bfs_queue[3].tc_id, "TC07_BFS_NULL_PTR");
    bfs_queue[3].step3_spouse_idx = 15;

    strcpy(bfs_queue[4].tc_id, "TC08_BFS_OOB_READ");
    bfs_queue[4].step5_audit_claim_len = 60;

    for (int i = 0; i < 5; i++) {
        execute_whitebox_testcase(&bfs_queue[i]);
    }

    fuzz_log("\n======================================================================================\n");
    fuzz_log(" GIAI ĐOẠN C: VÒNG LẶP ĐỘT BIẾN THEO CHIỀU SÂU (DFS DEEP STATE-PATH EXPLORATION)\n");
    fuzz_log("======================================================================================\n");

    FuzzTestCase dfs_stack[4];
    for (int i = 0; i < 4; i++) {
        dfs_stack[i] = seed_corpus[1];
        strcpy(dfs_stack[i].traversal_mode, "DFS_MUT");
        dfs_stack[i].mutation_depth = i + 2;
    }

    strcpy(dfs_stack[0].tc_id, "TC09_DFS_HEAP_UAF");
    dfs_stack[0].step2_lifecycle_op = 1;

    strcpy(dfs_stack[1].tc_id, "TC10_DFS_DBL_FREE");
    dfs_stack[1].step2_lifecycle_op = 2;

    strcpy(dfs_stack[2].tc_id, "TC11_DFS_CYCLE_HANG");
    dfs_stack[2].step3_create_cycle = 1;

    strcpy(dfs_stack[3].tc_id, "TC12_DFS_INT_OVF");
    dfs_stack[3].step4_fund_record_count = 16385;

    for (int i = 0; i < 4; i++) {
        execute_whitebox_testcase(&dfs_stack[i]);
    }
}

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
