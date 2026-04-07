# Nam Viet ERP

## Stack
Vite + React 19 + TypeScript strict + Ant Design 5 + Zustand 5 + TanStack Query 5 + Supabase

## Docs (BẮT BUỘC đọc khi cần context)
- [Architecture](docs/ARCHITECTURE.md) — folder structure, modules, patterns, formulas
- [Production Migration Plan](docs/PRODUCTION_MIGRATION_PLAN.md)

## Rules
- TypeScript strict, KHÔNG `any`, KHÔNG `@ts-ignore`
- Supabase RPC qua `safeRpc()` (`src/shared/lib/safeRpc.ts`) — KHÔNG gọi trực tiếp
- Database types auto-gen: `src/shared/types/database.types.ts` (`npm run typegen`)
- KHÔNG sửa `.env`, KHÔNG sửa lock files
- Max 300 dòng/file

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
