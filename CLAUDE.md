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
