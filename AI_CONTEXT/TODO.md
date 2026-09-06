# Project Task Backlog & Priorities

## P0: Immediate Priority (Must-Do in Next Session)
- [ ] Complete core feature implementation.
- [ ] Verify build and run automated tests.

## P1: High Priority (Upcoming Milestones)
- [ ] Implement user authentication and permissions.
- [ ] Configure deployment pipelines.

## P2: Backlog & Enhancements
- [ ] Performance optimizations and styling polish.

## ChristyKalvin Select 轉賣商城 (shopping.html)

### 已完成並實際部署（2026-09-06）
- [x] 前台 `public/shopping.html`、後台 `public/shopping-admin.html`
- [x] Cloud Functions（`christykalvin` 專案 / asia-east1）：`importProduct`、`uploadPhoto`、`deletePhoto`
- [x] `firestore.rules` 已部署到 `christykalvin` 專案的 `(default)` 資料庫
- [x] 商品照片改用函式自建的公開 bucket `christykalvin-shop-photos`（首次上傳時自動建立）
- [x] Artifact Registry 清理政策（保留 1 天，避免容器映像堆積產生費用）
- [x] 解析器測試 `functions/extract.test.js`（12 項，`cd functions && node extract.test.js`）
- [x] 預覽站台：`https://christykalvin--shop-preview-0sb0v618.web.app`（2026-10-06 到期）
- [x] **正式網址上線**（2026-09-06）：`firebase deploy --only hosting --project voiceout-asia` 已執行成功，
      `christykalvin.com/shopping.html`、`christykalvin.com/shopping-admin.html` 生效，
      未覆蓋既有頁面（myproperty、forex、calculator 等內容不變）。
- [x] **AI 翻譯潤飾**（2026-09-06）：改用 Gemini（原規劃的 Anthropic 因 Secret Manager 未開通而放棄），
      `importProduct` 讀 `functions/.env` 的 `GEMINI_API_KEY`（未 commit 進 git），
      模型 `gemini-3.6-flash`，同時產出中文與英文標題/描述，後台已加上「標題(英文)」「描述(英文)」編輯欄位。
      實測 bug 修好：`getStorage(...).createBucket is not a function` → 改用 `@google-cloud/storage` 客戶端直接建立 bucket。
- [x] **後台登入密碼**：已由使用者收信重設完成，可正常登入。
- [x] **端對端實測**：使用者實際貼 Takashimaya 連結匯入成功，商品照片正常顯示在前台。

### 待辦
- [ ] 之後若要擴充「真正線上購物車 + 金流付款」，目前是刻意先做「WhatsApp 詢問下單」的輕量版本，
      待確認需求後再評估 Stripe/PayPal 等金流串接
- [ ] `functions/.env` 只存在於這次部署的雲端 session 本機，換一台機器/session 操作前，
      要重新設定 `GEMINI_API_KEY`（同一組 key，找使用者要）才能重新部署 functions

## CK Holdings 集團雲端基礎設施與網域生命週期維護 (Domain & Cloud Lifecycle TODO)
- [x] 2026-08-29: 完成 CK Holdings Master Firebase 專案一號通 (One-Auth) 授權網域配置 (`voiceout.asia`, `sougu.online`, `christykalvin.com`)。
- [x] 2026-08-29: 透過 CLI 建立專屬獨立 Firestore 資料庫實例：`sougu-db`、`christykalvin-db`、`creditcard`、`dead-man-switch`。
- [x] 2026-08-29: 建立 Firebase Multi-Site Hosting 站點目標 (`sougu-online`, `christykalvin-web`, `voiceout-asia`) 並綁定本地 `.firebaserc` / `firebase.json`。
- [x] 2026-08-29: 清理 `(default)` 資料庫中非 VoiceOut 殘留集合 (`cc_users`, `jpcc_users`)。
- [ ] **【重要 DNS 維護】Cloudflare DNS 保持灰色雲朵（DNS Only 模式）**：
  - 確保 `christykalvin.com`、`sougu.online` 等自訂網域在 Cloudflare 上的 `A` 記錄維持 **DNS Only (灰色雲朵 ☁️)**，確保 Google Firebase 自動 SSL 憑證簽發與續簽 100% 暢通不被攔截。
- [ ] **【2027 網域自動扣款防禦】解除 GMO (お名前.com) 冗餘網域自動續費**：
  - 在 お名前.com 後台「ドメイン自動更新設定」中，將非核心網域 (`voiceout.click`, `voiceout.help`, `voiceout.online`, `ck-japan.shop`, `ck-japan.net`) 設定為「解除自動更新」，避免 2027 年產生無謂扣款。
- [ ] **【2027 網域續約/轉移準備 (Domain Transfer to Cloudflare)】**：
  - 2027/01/15 前：`voiceout.asia` 評估無痛轉移至 Cloudflare Registrar 以批發成本價 ($9.77/yr) 永久續費。
  - 2027/04/14 ~ 2027/08/27 前：`christykalvin.com` 與 `sougu.online` 視情況由 Cloudflare 承接續約。
