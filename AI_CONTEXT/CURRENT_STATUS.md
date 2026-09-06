# Live Project Status (Single Source of Truth)

## 1. Current Phase
- **Active Milestone**: Phase 1 - Architecture Setup & Core Implementation
- **Current Objective**: Initializing project features and validating build pipeline.

## 2. Functional Verification Matrix
| Module / Feature | Status | Verified with Live Logs? | Notes |
| :--- | :--- | :--- | :--- |
| Project Foundation | Completed | Yes | Master AI Context framework integrated |
| Core Feature A | In Progress | Inferred | Implementation underway |
| ChristyKalvin Select — Firestore rules (`christykalvin` 專案) | Deployed | Yes | `firebase deploy --only firestore:rules` 回報 released 成功 |
| ChristyKalvin Select — Cloud Functions `importProduct` / `uploadPhoto` / `deletePhoto` | Deployed | Yes | `firebase functions:list` 確認三個 callable 皆在 asia-east1 上線 |
| ChristyKalvin Select — 商品頁解析器 (`functions/extract.js`) | Verified | Yes | `node extract.test.js` 12 項測試全數通過（og:meta / JSON-LD / 相對路徑 / 價格容錯） |
| ChristyKalvin Select — 前後台網頁（預覽站台） | Deployed | Yes | hosting channel `shop-preview` 部署成功，14 個檔案上傳完成 |
| ChristyKalvin Select — 端對端實測（登入 → 匯入 → 上架 → 前台顯示） | NOT VERIFIED | No | 雲端 session 的網路政策擋掉 `*.web.app` 與 `cloudfunctions.net`，AI 無法自行開頁面或呼叫函式測試；且後台密碼未知。需由使用者實際操作驗證 |
| ChristyKalvin Select — AI 翻譯潤飾 | Not Configured | No | `ANTHROPIC_API_KEY` 尚未設定，目前匯入的是日文原文草稿 |

## 3. Active Blockers & Critical Notes
- **正式網址尚未上線**：`christykalvin.com/shopping.html` 需要部署到 `voiceout-asia` 專案的 hosting，該指令在 Claude 的雲端 session 會被安全機制擋下（該專案同時服務多個品牌網站）。使用者本機執行 `firebase deploy --only hosting --project voiceout-asia` 即可。
- **不可覆蓋 `christykalvin.web.app` 的 live 內容**（使用者 2026-09-06 明確指示），因此該站台只使用預覽頻道（preview channel）。
- **端對端功能尚未實測**：所有元件都已部署且個別驗證過，但完整流程（登入後台 → 貼連結匯入 → 照片 bucket 自動建立 → 前台顯示）尚未有人實際跑過一次。
