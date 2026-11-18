# Gallery Atlas

瀏覽、欣賞、收藏公有領域藝術作品的網站。作品資料與圖片來自芝加哥藝術博物館（Art Institute of Chicago）的公開 API。

> An independent, thoughtfully designed space to discover, appreciate, and curate public-domain art.

網站：尚未部署（預計部署到 Cloudflare Workers）

技術：vinext（在 Vite 上執行的 Next.js App Router API）、React 19、TypeScript（strict）、Tailwind CSS v4，部署在 Cloudflare Workers。

> This is an independent project and is not affiliated with the Art Institute of Chicago.
> 本站為個人作品，與芝加哥藝術博物館無關。

## 開發

需要 Node.js 22 以上（開發時用 26）。

```bash
npm install
npm run dev          # 開發伺服器
npm run build        # 建置 Cloudflare Worker
npm run start        # 在本機 workerd 預覽建置結果
npm run deploy       # 部署到 Cloudflare Workers
```

```bash
npm run lint
npm run typecheck
```

環境變數見 `.env.example`。`AIC_CONTACT_EMAIL` 只在伺服器端使用，會放進送給館方 API 的 `AIC-User-Agent` 標頭。本機開發可以不填，正式上線要填一個有效的公開聯絡信箱。

## 資料來源與授權

- API：[Art Institute of Chicago API](https://api.artic.edu/docs/)，圖片走館方的 IIIF Image API。所有對館方的請求都由伺服器端發出，館方對匿名請求的限制是每分鐘 60 次。
- 只顯示 `is_public_domain` 為 `true` 且有 `image_id` 的作品圖片。圖片直接連結館方 IIIF，不下載到本 repo。
- 作品 metadata 為 CC0；作品的 `description` 欄位是 CC BY 4.0，要顯示時必須標示來源。圖片的使用以館方的 [Image Licensing](https://www.artic.edu/image-licensing) 與 [Terms](https://www.artic.edu/terms) 為準。
- 網站上的來源標示：Image and artwork data courtesy of the Art Institute of Chicago。
- 不提供高解析圖下載。

## 實作進度

| 階段    | 內容                                   | 狀態   |
| ------- | -------------------------------------- | ------ |
| Phase 0 | 專案初始化、lint、型別檢查、建置       | 完成   |
| Phase 1 | 版面、設計 token、共用元件、About      | 未開始 |
| Phase 2 | 館方 API 串接、搜尋、篩選、分頁        | 未開始 |
| Phase 3 | 作品詳情、收藏                         | 未開始 |
| Phase 4 | 自訂策展清單                           | 未開始 |
| Phase 5 | 無障礙、SEO、README、GitHub Actions CI | 未開始 |
| Phase 6 | 部署到 Cloudflare Workers、正式站驗證  | 未開始 |

## 技術決策

- 用 vinext 而不用 Next.js 加 OpenNext：要部署到 Cloudflare Workers，vinext 原生支援，建置也比較輕。程式碼照 Next.js App Router 的寫法，萬一碰到 vinext 解決不了的相容問題，可以換回 Next.js 加 OpenNext。
- vinext 的 `next/image` 沒有建置期圖片最佳化，作品圖直接用館方 IIIF 的固定尺寸，加上 lazy loading 與明確的寬高。
- Cloudflare KV 資料快取與 Cloudflare Images 目前關閉，部署時再評估。在那之前 vinext 用記憶體快取，Workers 上不會跨 isolate 保留。
- 程式碼放在 `src/`，路徑別名 `@/*` 指向 `src/*`。

## 暫時無法升級的套件

- TypeScript 停在 6.0：typescript-eslint 還不支援 7。
- ESLint 停在 9：eslint-plugin-jsx-a11y 還不支援 10。
- `@cloudflare/vite-plugin` 2.x 與 `cf` 目前是 beta／rc，這是 vinext 對 Cloudflare 的建議設定；穩定版的 1.x 屬於舊的 Wrangler 設定方式。

## 已知問題

- `npm audit` 還有上游套件的警告，沒有不降版的修正：picomatch（ReDoS，所有版本都受影響，經由 vite 與 vinext 在建置時比對檔案路徑）、fflate（經由 `@vercel/og`，本專案沒有用到 OG 圖片產生）。`npm audit fix --force` 會把 vinext 降到 0.2.1，所以不採用。
- npm 擋下了 `workerd` 的 postinstall script，目前本機預覽仍可正常執行。
