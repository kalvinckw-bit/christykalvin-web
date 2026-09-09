# Constitutional Project Decisions Registry (DECISIONS.md)

This document records permanent architectural, design, and policy decisions approved by the user.
**DECISIONS ARE PERMANENT AND CONSTITUTIONAL.** No AI may revert, modify, or re-debate approved decisions without explicit user instruction.

---

### Decision 001: Multi-AI Governance & Session Lifecycle
- **Date**: {{DATE}}
- **Status**: APPROVED
- **Context**: The project is developed across multiple machines (MacBook, Windows) and multiple AI tools.
- **Rule**:
  1. All AIs must begin with `start` and conclude with `end`.
  2. Each AI maintains only its own designated file under `AI_CONTEXT/SESSIONS/`.
  3. `end` automatically commits and pushes session records and changes to Git remote.

### Decision 002: Architecture & Code Standards
- **Date**: {{DATE}}
- **Status**: APPROVED
- **Rule**: All source code must adhere strictly to the tech stack and guidelines defined in `PROJECT_OVERVIEW.md`.

---

### Decision: CK Holdings Group Unified Authentication & Cloud Architecture (集團一號通與中央雲端架構)
- **Status**: APPROVED
- **Date**: 2026-08-29
- **Context**: CK Holdings operates multiple brand portals and services (Voice Out, Sougu / Crosspath, ChristyKalvin, etc.). To prevent user registration fatigue and simplify cross-brand infrastructure, all services must share a single Master Authentication system.
- **Rule**:
  1. **Master Project Identity**: The Firebase Master Project is `CK Holdings` (Project ID: `voiceout-asia`).
  2. **Single Sign-On (One Auth)**: All frontend websites and apps (`voiceout.asia`, `sougu.online`, `christykalvin.com`, etc.) share the same Firebase Authentication instance. Users register once and maintain a consistent UID across the entire group.
  3. **Multi-Database Partitioning**: Business data for distinct brands is physically isolated using dedicated Firestore Database instances under the same Master Project:
     - `(default)`: Voice Out Web / Mobile App
     - `sougu-db`: Sougu (Crosspath)
     - `christykalvin-db`: ChristyKalvin Official Web
     - `creditcard`: Credit Card / Billing sub-system
     - `dead-man-switch`: Dead-Man-Switch sub-system
  4. **Multi-Site Hosting**: Each brand domain is mapped as an independent Hosting site target within the Master Project.

---

### Decision: AI Proactive Autonomous Execution Policy (AI 主動自主執行原則 / 禁止把 AI 能做的事推給用戶)
- **Status**: APPROVED
- **Date**: 2026-08-29
- **Context**: 用戶聘請並使用 AI 是為了極大化自動化與研發效率，而不是接收 AI 的操作指示自行手動操作。過去多次發生 AI 明明具備 CLI / 工具 / 腳本執行能力，卻習慣性列出步驟指導用戶去後台手動點擊或手動修改，嚴重違反專案效率原則。
- **Constitutional Rules (憲法級硬性準則)**:
  1. **AI 優先直接執行（Execute Directly First）**：凡是 AI 擁有工具權限能做的事（包含但不限於 Firebase CLI / 雲端資源開通、資料庫建立、環境變數配置、腳本執行、檔案修改、代碼生成、Git 自動化），AI **必須直接調用工具自主完成**，嚴禁發出「請您到後台手動點擊」、「請您自行建立」等指示。
  2. **僅限不可替代之真人行為才要求用戶參與（Human-Only Escalation Only）**：只有在牽涉「真人雙重認證（2FA/SMS 驗證碼）」、「外部金流實際付款扣款」、「重大商業策略決策確認」等物理上 AI 絕對無法執行的情況下，才允許請求用戶操作。
  3. **拒絕給用戶出作業（No Homework for User）**：AI 的責任是「徹底解決問題並交付成果」，做完後主動呈報具體執行細節與檔案路徑，而非把任務分解後丟回給用戶手動執行。

---

### Decision: CK Holdings Maximum User Telemetry & Device Intelligence Policy (全方位用戶設備與環境情報收集準則)
- **Status**: APPROVED
- **Date**: 2026-08-29
- **Context**: 為了防範集團旗下各平台遭到詐騙、濫用、盜號、惡意機器人攻擊，並掌握全方位業務與用戶設備分佈情報，所有 CK Holdings 旗下網站與應用程式必須在用戶登入與訪問時，自動、無感、最大化地採集所有可獲取之客戶端情報。
- **Constitutional Rules (憲法級硬性準則)**:
  1. **全方位情報採集範圍（Maximum Obtainable Scope）**：
     - **網路與位置**：真實公網 IP (IPv4/IPv6)、國家、城市、地區、時區、ISP 電信商、連線類型 (WiFi/5G/4G)、下載頻寬估算、延遲 (RTT)。
     - **設備與硬體**：設備類型 (Mobile/Tablet/Desktop)、作業系統及版本 (iOS/Android/Win/Mac)、瀏覽器及核心版本、螢幕解析度、可用解析度、色彩深度、像素比、CPU 核心數、記憶體估算 (RAM GB)、觸控點數支援。
     - **環境與語系**：系統語言、偏好語言清單、用戶時區、與 UTC 時差、深色/淺色主題偏好、Cookies/Storage 支援狀態。
     - **行為與來源**：訪問網域 (siteId)、當前 URL、來源網址 (Referrer / UTM)、時間戳記 (ISO/Timestamp)、UID 與 Email。
  2. **靜默自動寫入資料庫（Silent Persistence）**：
     - 每次用戶登入或啟動應用時，前端自動將最新快照更新至 users/{uid} (包含 last_telemetry, last_ip, last_device, last_city, last_country, last_login_at)。
     - 同步追加寫入至子集合 users/{uid}/telemetry_logs/{logId} 作為完整歷史審計日誌。
  3. **非阻塞與容錯原則（Graceful Fallback）**：
     - 能收集到的全部收集，若特定瀏覽器沙盒或隱私限制無法取得某欄位，則優雅降級 (Fallback)，絕對不可阻礙用戶正常使用介面。

---

### Decision: Mandatory Automatic Git Pull on Start & Git Push on End (開局必 Pull 收工必 Push 鋼鐵憲法)
- **Status**: APPROVED & MANDATORY
- **Date**: 2026-09-02
- **Context**: 針對部分 AI 誤以為 AI_CONTEXT 僅是本機留言板、不需要自動同步雲端的怠惰誤解，集團特此頒布鋼鐵憲法。
- **Constitutional Rules (憲法級硬性準則)**:
  1. **開局必 Pull（Mandatory Pull on `start`）**：
     - 每次使用者輸入 `start` 或 AI 開始新 Session 時，AI **必須首先自動執行 `git pull --rebase`**，將 GitHub 遠端最新進度拉取至本機。嚴禁以「未要求同步雲端」為由略過！
  2. **收工必 Push（Mandatory Push on `end`）**：
     - 每次使用者輸入 `end` 或任務告一段落時，AI **必須自動執行 `git add -A`、`git commit` 並立即 `git push` 至 GitHub 遠端儲存庫**。
     - **嚴禁留給使用者手動執行！嚴禁宣稱『AI_CONTEXT 沒有要求 push』！**
  3. **雙重同步架構定位（OneDrive + GitHub）**：
     - OneDrive 負責跨裝置（Windows ⟷ Mac）檔案即時傳輸。
     - GitHub 負責版本歷史與多 AI 程式碼同步。
     - **任何 AI 結束工作時未執行 `git push`，即視為嚴重失職與交接漏洞！**

---

### Decision: ChristyKalvin Select 轉賣商城架構 (shopping.html EC Platform)
- **Status**: APPROVED
- **Date**: 2026-09-06
- **Context**: Christy 需要一個類似 BASE/Mercari 風格的日本代購轉賣網站，網址為 `christykalvin.com/shopping.html`，並且要能「貼上原始商品連結，自動把照片/標題/描述匯入」，減少手動上架的重複工作。
- **Rule**:
  1. **後端獨立於 `christykalvin` 專案（2026-09-06 使用者決定，取代原本共用 `voiceout-asia` 的規劃）**：
     商城的 Firestore（`(default)` 資料庫，collection: `products`）、Cloud Functions（asia-east1）、
     Auth 皆位於 Firebase 專案 `christykalvin`（專案編號 488782388942），理由是此站只有 Christy 一位
     管理員、沒有一般會員，不需要納入集團一號通（One Auth）。
     靜態網頁（`public/`）仍由 `voiceout-asia` 專案的 `christykalvin-web` 站台服務 `christykalvin.com`，
     形成「Hosting 在 A 專案、資料在 B 專案」的跨專案架構（前端 SDK 指向 `christykalvin` 的設定即可）。
  2. **前台/後台分離**：`public/shopping.html` 為公開瀏覽/搜尋/詢問頁面（唯讀，只顯示 `status == "published"` 商品）；`public/shopping-admin.html` 為登入後台，負責商品 CRUD、照片上傳、上下架與售出狀態管理。
  3. **購買流程 = WhatsApp 詢問下單**：不做金流/購物車，商品詳情頁的 CTA 一律導去 WhatsApp（沿用 `myproperty` 既有的平台 WhatsApp 號碼 `601128874818`），待需求明確後再評估是否升級成真正線上金流結帳。
  4. **貼連結自動匯入 = Cloud Function + AI 輔助，人工複核後才發布**：`functions/importProduct`（Firebase Functions v2, callable, region `asia-east1`）伺服器端抓取來源網頁（主要目標為 Takashimaya Online，其餘網店以通用 og:meta / JSON-LD 解析器為主）、下載照片重新上傳到自己的 bucket（避免原網站下架後圖裂），若有設定 `ANTHROPIC_API_KEY` 則呼叫 Claude 把日文標題/描述翻譯潤飾成繁體中文。匯入結果一律先寫成 `status:"draft"`，需要後台人工核對才能改成 `published`，不做全自動免審發布。
  5. **貨幣顯示**：前台以日圓 (JPY) 為主要顯示貨幣，另外依訪客 IP 地區（沿用 `ck-telemetry.js` 已使用的 `freeipapi.com`）換算對應在地貨幣顯示在括號內作參考，僅供估算，不做即時金流換匯結帳。
  6. **照片儲存不使用 Firebase Storage**：`christykalvin` 專案未開通 Firebase Storage，且該開通動作只能在 Firebase Console 手動點選、CLI 無對應指令。因此改由 Cloud Function 以自身服務帳號建立並維護一個公開讀取的 Cloud Storage bucket `christykalvin-shop-photos`（`ensurePhotoBucket()`，首次使用時自動建立，冪等）。後台手動上傳照片改走 `uploadPhoto` callable（前端送 base64），刪除走 `deletePhoto`，前台以 `https://storage.googleapis.com/christykalvin-shop-photos/...` 直接顯示。前端不再引用 Firebase Storage SDK。

---

### Decision: Universal Dual-Cloud Mirror Parity for All Group Projects (全集團專案 OneDrive ⟷ Google Drive ⟷ GitHub 三位一體同步憲法)
- **Status**: APPROVED & MANDATORY
- **Date**: 2026-09-09
- **Context**: 全集團旗下所有專案（不僅限於 ChristyKalvinWeb，而是涵蓋 `Projects` 底下所有子專案：`CK Holdings` 旗下所有子專案、`Facebook Auto Post`、`Laundry + Cafe`、`Python` 工具群、`00 Master AI Context Template` 等），在 Google Drive 均有對應之實體鏡像目錄（`G:\マイドライブ\Projects\<專案名稱>`）。為落實跨 AI、跨裝置、跨微軟/谷歌雲端生態的絕對對齊，全集團專案必須遵循三位一體同步規範。
- **Constitutional Rules (憲法級硬性準則)**:
  1. **全集團一體適用（Universal Group Scope）**：所有位於 `Projects` 目錄下之專案，一律強制適用本同步規範，絕無例外，嚴禁誤判為特定單一專案獨有！
  2. **收工手動鏡像（Mandatory End Handoff Parity）**：Google Drive 鏡像無自動雲端排程或 Webhook 機制，任何 AI（Claude、Antigravity、ChatGPT、Codex 等）在執行 `end` 時，**必須主動找出本次 session 異動之檔案，並同步更新複製至 Google Drive 該專案根目錄鏡像對應路徑**（本專案鏡像為 `G:\マイドライブ\Projects\ChristyKalvinWeb\`，若在純雲端無本地磁碟掛載之環境如 Web Claude，則必須調用 Google Drive API 上傳）。
  3. **交接報告具體透明（Transparent Audit Trail）**：收工報告中必須具體列出同步檔案名稱與目標路徑/ID，嚴禁僅以「已同步」含糊帶過，嚴禁省略。
  4. **嚴禁跳過與假設**：嚴禁跳過此步驟、嚴禁假設「應該還是最新的」——忘記檢查即代表雲端鏡像停擺！
  5. **嚴禁狹隘單點修改（Anti-Silo Mandate）**：規則修訂必須同時更新 `AGENTS.md`、`CLAUDE.md`、`CHATGPT.md`、`AI_CONTEXT/END_SESSION.md`、`AI_CONTEXT/DECISIONS.md`，誰改動誰負責對齊全體 AI。
