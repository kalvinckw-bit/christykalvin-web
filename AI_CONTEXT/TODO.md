# Project Task Backlog & Priorities

## P0: Immediate Priority (Must-Do in Next Session)
- [ ] Complete core feature implementation.
- [ ] Verify build and run automated tests.

## P1: High Priority (Upcoming Milestones)
- [ ] Implement user authentication and permissions.
- [ ] Configure deployment pipelines.

## P2: Backlog & Enhancements
- [ ] Performance optimizations and styling polish.

## Monku (吐槽/辯論) Feature — public/monku.html
- [x] 2026-09-14: Brainstormed scope, legal framing (UGC vs platform liability, opinion vs accusation), and content rules (extreme content removal, camera-only capture, no gallery upload) — brief only, no code yet.
- [x] 2026-09-14: Built MVP `public/monku.html` — 商品/人物/公司/其他 topic categories, JAN/統編 optional code field, 正反(同意/反對) two-column comments, hashtags with autocomplete/dedupe, anonymous Firebase Auth posting, camera-only photo capture (`capture="environment"`, no gallery input), client-side extreme-word filter + report/auto-hide-at-3-flags moderation, search + category filter. Uses Firestore `monku_topics` collection on the `(default)` database (per COMPANY_PROFILE.md — Voice Out's DB). Sentiment analysis / reputation scoring / push notifications / multi-language intentionally deferred.
- [ ] **BLOCKED (deploy)**: This repo's `firebase.json` hosting target is `christykalvin-web`, one of THREE separate Firebase Hosting sites under project `voiceout-asia` (see line below: `sougu-online`, `christykalvin-web`, `voiceout-asia` are distinct sites). This strongly suggests `christykalvin-web` is bound to the `christykalvin.com` custom domain, NOT `voiceout.asia` — meaning deploying *this* repo may never make `monku.html` appear at `voiceout.asia/monku.html`. **Needs verification**: check the Firebase Console → Hosting → which custom domain is bound to which site target, and confirm whether `monku.html` belongs in this repo at all or in whatever repo deploys the `voiceout-asia` hosting site.
- [ ] **BLOCKED (deploy)**: No Firebase CLI / credentials available in the remote cloud sandbox, and no `.github/workflows` CI/CD pipeline exists in this repo — deployment (`firebase deploy --only hosting:<site>`) must be run manually from a local machine that has the Firebase CLI logged in.
- [ ] **BLOCKED (data)**: `Firestore Security Rules` for the `monku_topics` collection (and its `comments` subcollection) are not managed in this repo (no `firestore.rules` file found) — need to be added/deployed via Firebase Console or CLI so anonymous-auth users can create topics/comments and the public can read `status=="visible"` docs.
- [ ] Once live: verify anonymous auth is enabled in Firebase Console (Authentication → Sign-in method → Anonymous).
- [ ] `G:\マイドライブ\Projects\00 Master AI Context Template` still unread — not accessible from remote/cloud sessions (local Windows path). Needs a local session or user-provided content.
- [ ] Defer to later phase: AI sentiment analysis, reputation scoring, auto stance summaries, push notifications, multi-language.

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
