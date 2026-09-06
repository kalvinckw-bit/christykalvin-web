# Project Task Backlog & Priorities

## P0: Immediate Priority (Must-Do in Next Session)
- [ ] Complete core feature implementation.
- [ ] Verify build and run automated tests.

## P1: High Priority (Upcoming Milestones)
- [ ] Implement user authentication and permissions.
- [ ] Configure deployment pipelines.

## P2: Backlog & Enhancements
- [ ] Performance optimizations and styling polish.

## ChristyKalvin Select 轉賣商城 (shopping.html) 待辦事項
- [x] 2026-09-06: 建立前台 `public/shopping.html`、後台 `public/shopping-admin.html`、Cloud Function `functions/importProduct`、`firestore.rules`、`storage.rules`，並更新 `firebase.json`。
- [ ] **【必須手動執行 - 需要擁有者 Firebase 帳號權限】** 部署到雲端：
  - `firebase login`（如尚未登入）→ `firebase use voiceout-asia`
  - `firebase deploy --only firestore:rules,storage:rules,functions,hosting:christykalvin-web`
  - functions 需要先跑 `cd functions && npm install`
- [ ] **【必須手動執行 - 需要真人 API 金鑰】** 設定 AI 潤飾用的 Anthropic API Key：
  - `firebase functions:secrets:set ANTHROPIC_API_KEY`（貼上 Christy 的 Anthropic Console API Key）
  - 沒有設定的話，「貼連結匯入」功能還是能運作，只是不會自動翻譯成中文，會匯入日文原文草稿讓人工補翻譯
- [ ] 到 Firebase Console → Authentication 確認/新增管理員登入帳號（跟 `myproperty/admin.html` 共用同一組 Firebase Auth 使用者即可，不需要另外註冊）
- [ ] 第一次上架商品後，Firestore 若跳出「需要建立複合索引 (composite index)」的錯誤連結，直接點擊該連結建立索引即可（`products` collection 的 `status == published` 查詢）
- [ ] 之後若要擴充「真正線上購物車 + 金流付款」，目前是刻意先做「WhatsApp 詢問下單」的輕量版本，待確認需求後再評估 Stripe/PayPal 等金流串接

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
