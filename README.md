# 自學日文筆記

`Next.js + SCSS + Supabase + Cloudflare Workers` 的日文自學部落格。

## 功能

- 前台首頁、文章列表、分類頁、文章內頁
- 木質淡色系視覺：白底、`#f4e3cf`、`#e4c4b7`、`#f2d2bb`
- Supabase Auth 後台登入
- 文章、分類、廣告管理頁
- 區塊式文章編輯器：標題、段落、圖片、YouTube、例句、重點框
- 自管廣告與 AdSense 插槽
- Cloudflare Workers / OpenNext 部署設定

## 本機設定

```bash
npm install
npm run dev
```

建立 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ADSENSE_CLIENT=
```

沒有 Supabase 環境變數時，前台會使用範例資料，後台表單會提示尚未設定。

## Supabase

1. 建立 Supabase 專案。
2. 執行 `supabase/migrations/202607020001_initial_blog_schema.sql`。
3. 建立 Auth 使用者。
4. 在 `profiles` 新增該使用者的 `id`，並設定 `role = 'admin'`。

## Cloudflare Workers

```bash
npm run preview
npm run deploy
```

Cloudflare secrets 需要設定與 `.env.local` 對應的 Supabase／AdSense 變數。

## 素材

第一版品牌素材放在 `public/brand`：

- `host-wave.png`
- `host-heart.png`
- `japannote-badge.png`
- `wood-pattern.png`
