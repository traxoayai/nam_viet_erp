# Nam Viet ERP

## Stack
Vite + React 19 + TypeScript strict + Ant Design 5 + Zustand 5 + TanStack Query 5 + Supabase

## Docs (BẮT BUỘC đọc khi cần context)
- [Architecture](docs/ARCHITECTURE.md) — folder structure, modules, patterns, formulas
- [Business Logic](docs/BUSINESS_LOGIC.md) — nghiệp vụ tất cả module: luồng, RPC, gotchas (ĐỌC KHI LÀM TASK)
- [Production Migration Plan](docs/PRODUCTION_MIGRATION_PLAN.md)

## Rules
- TypeScript strict, KHÔNG `any`, KHÔNG `@ts-ignore`
- Supabase RPC qua `safeRpc()` (`src/shared/lib/safeRpc.ts`) — KHÔNG gọi trực tiếp
- Database types auto-gen: `src/shared/types/database.types.ts` (`npm run typegen`)
- KHÔNG sửa `.env`, KHÔNG sửa lock files
- Max 300 dòng/file
- KHÔNG hardcode secret (SERVICE_ROLE_KEY, Supabase PAT, JWT) trong source — phải đọc từ env var

## Setup secrets (lần đầu clone)

### MCP server (Supabase Personal Access Token)
`.mcp.json` là placeholder dùng `${MCP_SUPABASE_TOKEN}` — KHÔNG chứa token thật.
Để Claude Code / IDE chạy được Supabase MCP, copy file example rồi paste PAT thực vào file local (đã gitignore):

```bash
cp .mcp.local.json.example .mcp.local.json
# Mở .mcp.local.json, thay sbp_YOUR_... bằng PAT từ Supabase Dashboard → Account → Access Tokens
```

Hoặc set env var `MCP_SUPABASE_TOKEN` ở shell/profile để `.mcp.json` resolve trực tiếp.

### Scripts & test helpers (Service role key)
`scripts/*` và `tests/helpers/supabase.ts` đọc key qua env. Set trước khi chạy:

```bash
export SUPABASE_SERVICE_ROLE_KEY="<prod service role key>"
export SUPABASE_ANON_KEY="<prod anon key>"          # chỉ cần khi TEST_TARGET=prod
export SUPABASE_LOCAL_SERVICE_ROLE_KEY="<local demo>"  # tuỳ chọn — fallback về SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_LOCAL_ANON_KEY="<local demo>"          # tuỳ chọn — fallback về SUPABASE_ANON_KEY
```

Lấy key từ Supabase Dashboard → Project Settings → API. Local demo keys nằm trong output `supabase status`.

## Regression Prevention (BẮT BUỘC)

### Khi sửa RPC call trong hooks/services:
1. **Check PG types** — Tham số `timestamptz`, `bigint`, `uuid`, `date` PHẢI dùng `|| null`, KHÔNG BAO GIỜ `|| ""`. Chỉ `text/varchar` mới được `|| ""`.
2. **Sync unit test** — Sau khi fix code, kiểm tra unit test có assert giá trị cũ (sai) không. Unit test phải match hành vi đúng, không phải ngược lại.
3. **Chạy cả 2 tầng test** — `npm run test:unit` + `npm run test:rpc` cho module liên quan.

### Khi viết migration sửa function (CREATE OR REPLACE):
1. **Đọc version hiện tại** — `grep -n 'function_name' supabase/schema.sql` hoặc migration gần nhất. PHẢI đọc TOÀN BỘ function cũ.
2. **Diff trước khi viết** — Liệt kê rõ: giữ gì, sửa gì, thêm gì. KHÔNG ĐƯỢC bỏ sót logic có sẵn (CTEs, JOINs, calculations).
3. **Merge, không replace** — Khi fix 1 vấn đề, PHẢI giữ nguyên toàn bộ logic khác. Copy paste full function cũ → sửa phần cần sửa.
4. **Chạy verify** — `npx supabase db query -f <migration_file>` + test RPC trả đúng data.

## Commands
```bash
npm run dev          # Vite dev (:5173)
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run test:unit    # Vitest unit
npm run test:rpc     # Vitest RPC integration
npm run test:e2e     # Playwright E2E
npm run typegen      # Supabase type generation
```

## Key Files
| File | Vai trò |
|------|---------|
| `src/app/router/index.tsx` | Route config |
| `src/app/contexts/AuthProvider.tsx` | Auth session |
| `src/shared/lib/supabaseClient.ts` | Supabase client |
| `src/shared/lib/safeRpc.ts` | RPC wrapper (error handling, Vietnamese messages) |
| `src/shared/types/database.types.ts` | Auto-gen DB types |
| `src/features/auth/constants/permissions.ts` | RBAC permissions |
