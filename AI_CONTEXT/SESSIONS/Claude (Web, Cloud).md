# Claude (Web, Cloud) - Session Record

## Identity
- **AI Agent**: Claude (Claude Code)
- **Host Type**: Web / 雲端 session（claude.ai/code 啟動的遠端容器，非本機 IDE）
- **Machine / OS**: 雲端 Linux 容器（非 Windows 工作站、非 MacBook）
- **Designated Record File**: `AI_CONTEXT/SESSIONS/Claude (Web, Cloud).md`
- **備註**: REGISTRY.md 原本的 10 個身分都假設「Desktop / VS Code」×「Windows / MacBook」，
  沒有涵蓋雲端 web session。此身分為 2026-09-06 新增。

---

## ⚠️ 這個環境能做什麼、不能做什麼（給下一位 AI 的重要情報）

雲端 session 的能力邊界跟本機 AI **差很多**，接棒前務必先看這段，避免重複踩雷：

### 做得到
- Git 全部操作（pull / commit / push 到 GitHub）
- 安裝 CLI 工具（npm install -g firebase-tools 等）
- 使用者提供 `firebase login:ci` token 後，可執行大部分 Firebase CLI 操作
- 呼叫 Google APIs（googleapis.com 網域可通）：Firestore、Functions 部署、Identity Toolkit
- Google Drive / Gmail / Calendar / GitHub / Canva 的 MCP 連接器

### 做不到（真實踩過的雷）
1. **無法讀取本機 OneDrive**：`C:\Users\kalvi\OneDrive\...` 路徑不存在，
   onedrive.live.com 也沒有連接器。**Master AI Context 在雲端 session 讀不到**，
   只能依賴 repo 內的 `AI_CONTEXT/` 本地版本。
2. **網路白名單極嚴**：`*.web.app`、`christykalvin.com`、`voiceout.asia`、
   `cloudfunctions.net`、一般外部網站全部被 egress proxy 擋掉。
   → **無法自己開網頁驗證、無法呼叫自己部署的 Cloud Function 測試**。
   可通的只有 googleapis.com、npm registry、GitHub。
3. **部分指令被安全分類器擋下**（非權限不足，是 Claude 自身的安全機制）：
   - `firebase deploy --project voiceout-asia`（共用多品牌的正式專案，風險過高）
   - `firebase functions:secrets:set`（密鑰相關）
   - `firebase auth:export`（含密碼雜湊）
   - 讀寫 `.claude/settings.json`（AI 不得自行授予自己權限——這是刻意設計）
   → 針對 `christykalvin` 這個獨立專案的部署則**不受限**，可正常執行。
4. **Firebase Console 的操作一律做不到**（例如 Storage 的「Get Started」開通），
   CLI 沒有對應指令。遇到這種情況要想替代方案，不要直接丟回給使用者。

---

## Session History & Objectives

### 2026-09-06 — 建立 ChristyKalvin Select 轉賣商城
- **Status**: 主體完成並部署，端對端未實測
- **Branch**: `claude/ec-resale-platform-ku6xau`
- **Last Commit**: 2a4f7c8

#### Work Completed（做過的事情）
1. **前台** `public/shopping.html`：BASE / Mercari 風格商城
   - 商品格狀列表、分類 chips、搜尋、排序、商品詳情彈窗
   - 價格以 JPY 為主，依訪客 IP 地區（freeipapi.com，沿用 ck-telemetry.js 同一家）
     在括號附上當地貨幣估算（匯率來源 open.er-api.com，localStorage 快取 12 小時）
   - CTA 為 WhatsApp 詢問下單（號碼 601128874818，沿用 myproperty 平台號碼），不做金流
   - Light theme + Meiryo 字體（使用者指定）
2. **後台** `public/shopping-admin.html`：Firebase Auth 登入
   - 商品 CRUD、多照片上傳/刪除、上下架、已售出標記、草稿審核流程
   - 「貼連結自動匯入」分頁
3. **Cloud Functions**（`christykalvin` 專案 / asia-east1，皆為 callable）
   - `importProduct`：伺服器端抓取來源網頁 → 解析 → 下載照片轉存 → (可選) Claude 翻譯潤飾 → 寫入草稿
   - `uploadPhoto` / `deletePhoto`：後台手動照片管理（前端送 base64）
4. **`functions/extract.js`**：商品頁解析器（純函式模組）
   - og:meta、twitter card、schema.org JSON-LD（含 @graph）、itemprop
   - 相對路徑與 protocol-relative 圖片網址轉絕對網址
   - 價格容錯：product:price:amount、JSON-LD offers、內文「¥12,800」「3,980円」
   - `functions/extract.test.js` 12 項測試全過（`cd functions && node extract.test.js`）
5. **架構決策變更**：後端從共用的 `voiceout-asia` 改到獨立專案 `christykalvin`
   （使用者決定：此站只有一位管理員、沒有一般會員，不需納入集團一號通）
6. **照片儲存繞道**：`christykalvin` 專案沒開通 Firebase Storage 且 CLI 無法開通，
   改由函式用自身服務帳號建立公開 bucket `christykalvin-shop-photos`
   （`ensurePhotoBucket()` 冪等，首次使用自動建立）

#### Files Modified
- 新增：`public/shopping.html`、`public/shopping-admin.html`、
  `functions/{index.js, extract.js, extract.test.js, package.json, .gitignore}`、
  `firestore.rules`、`firebase.christykalvin.json`
- 修改：`firebase.json`、`AI_CONTEXT/{TODO.md, DECISIONS.md, CURRENT_STATUS.md}`
- 刪除：`storage.rules`（改用自建 bucket 後不需要）

#### 已實際部署並驗證
- Firestore rules → `christykalvin` 專案 `(default)` 資料庫 ✅
- 三個 Cloud Functions（`firebase functions:list` 確認在線）✅
- Artifact Registry 清理政策（保留 1 天，避免映像檔堆積產生費用）✅
- 預覽站台 `https://christykalvin--shop-preview-0sb0v618.web.app`（2026-10-06 到期）✅
- 解析器 12 項測試 ✅

#### Next Actions / Must-Do（必須要做的事情）
1. **正式上線**：`firebase deploy --only hosting --project voiceout-asia`
   （雲端 Claude 執行會被安全機制擋下，本機 AI 或使用者執行即可）
   → 生效後 `christykalvin.com/shopping.html` 可用
2. **後台密碼**：`kalvin.ckw@outlook.jp` 帳號已存在於 `christykalvin` 專案但密碼未知，
   已寄出重設密碼信，需使用者收信設定
3. **AI 翻譯潤飾**：設定 `ANTHROPIC_API_KEY`（環境變數或 Secret Manager），
   設定後要在 `importProduct` 的 options 加回 `secrets: ["ANTHROPIC_API_KEY"]` 並重新部署
4. **端對端實測**：登入後台 → 貼 Takashimaya 連結匯入 → 確認照片 bucket 自動建立成功
   → 發布 → 前台顯示。雲端 Claude 無法自行測試（網路白名單），需本機驗證

#### Known Risks / Unverified（未驗證項目，不可當成已完成）
- **完整流程從未實際跑過**：各元件個別驗證過，但沒有人跑過一次完整流程
- **`ensurePhotoBucket()` 尚未實際執行過**：bucket 建立與 allUsers 公開讀取權限設定
  在真實環境是否成功未知；若組織政策禁止公開 bucket，照片會無法顯示
  （函式已有容錯：會把警告寫進商品的 `ai_notes` 欄位）
- **Takashimaya 實際頁面結構未驗證**：解析器只用模擬 HTML 測過，
  真實頁面若靠 JS 動態載入商品資料，靜態抓取可能拿不到（需改用無頭瀏覽器）
- **使用者明確指示：不可覆蓋 `christykalvin.web.app` 現有的 live 內容**，
  因此該站台只使用 preview channel

#### Key Facts / IDs（省得下一位 AI 重查）
- Firebase 專案：`christykalvin`（編號 488782388942），Firestore `(default)`，collection `products`
- Web App ID：`1:488782388942:web:0501238a5c77fe9feeba9f`
- 照片 bucket：`christykalvin-shop-photos`（ASIA-NORTHEAST1，公開讀取）
- Functions region：`asia-east1`
- 靜態網頁仍由 `voiceout-asia` 專案的 `christykalvin-web` 站台服務 `christykalvin.com`
- Google Drive 專案備份：Projects / ChristyKalvin Select 轉賣商城
