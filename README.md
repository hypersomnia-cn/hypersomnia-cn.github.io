# IH

Node.js 22.12+ / pnpm

## Dev

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

## Build / Preview

```powershell
pnpm build
pnpm preview
```

http://127.0.0.1:4173/

## Check

```powershell
pnpm check
pnpm format:check
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

## Edge

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm test:e2e
```

## Base Path

```powershell
$env:NEXT_PUBLIC_BASE_PATH = '/webside'
pnpm build
pnpm preview
```

http://127.0.0.1:4173/webside/
