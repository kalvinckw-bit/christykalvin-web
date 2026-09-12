# Live Project Status (Single Source of Truth)

最後更新：2026-09-12（Claude Web Cloud session）

## 1. Current Phase
- **Active Milestone**：ChristyKalvin Select 轉賣商城 — 正式上線後的功能調整與部署自動化
- **Current Objective**：CI/CD 自動部署已建立，持續依使用者回饋調整前後台欄位與 AI 匯入邏輯

## 2. Functional Verification Matrix
| Module / Feature | Status | Verified with Live Logs? | Notes |
| :--- | :--- | :--- | :--- |
| Firestore rules（`christykalvin` 專案） | Deployed | Yes | `products` 公開讀已上架商品；`inquiries` 訪客可 create、僅登入者可讀 |
| Cloud Functions `importProduct` / `uploadPhoto` / `deletePhoto` | Deployed | Yes | asia-east1，2026-09-07 CI 部署 log 顯示三支皆 "Successful update operation" |
| 商品頁解析器 `functions/extract.js` | Verified | Yes | `node extract.test.js` 13 項測試全數通過 |
| AI 翻譯潤飾（Gemini） | Deployed | Yes | `gemini-3.6-flash`，key 放在 `functions/.env`（未進 git），deploy log 有 "Loaded environment variables from functions/.env" |
| 前台 `shopping.html`（含中英切換、顏色選擇、留言詢問表單） | Deployed | Yes | hosting site `christykalvin-web`（`voiceout-asia` 專案） |
| 後台 `shopping-admin.html`（商品管理／貼連結匯入／買家詢問） | Deployed | Yes | 同上 |
| GitHub Actions 自動部署 | Deployed | Yes | `.github/workflows/deploy-shopping.yml`，push 到 branch 即自動部署並驗證正式站內容 |
| 端對端實測（登入 → 匯入 → 上架 → 前台顯示） | Verified by user | Yes | 使用者已實際匯入商品成功（例：PRESS BUTTER SAND） |
| 主題標籤系統（`settings/themes`，跟分類無關，例如 moomin/Hello Kitty） | Deployed | Yes | 前後台皆已用點選 chip 方式管理，2026-09-12 驗證上線 |
| PWA 強制更新（build-version.json + commit SHA 比對） | Deployed | Yes | 解決加到手機主畫面後顯示舊版畫面的問題 |
| peachjohn.co.jp 通用解析（照片/顏色/尺寸三項） | Deployed | Yes | `functions/extract.js` 通用規則，19 項 `extract.test.js` 全過，賣家重新匯入截圖確認顏色抓到 |
| 售價 ¥0 真兇修復（`Number(null)===0`） | Deployed | Yes | `pricing.js` 改用 `== null` 明確判斷，17 項 `pricing.test.js` 全過 |

## 3. 重要架構事實（不要再重新推論）
- **Hosting**：正式站 `christykalvin.com` = `voiceout-asia` 專案裡的 **`christykalvin-web`** site。已用 CI 抓取驗證過（`christykalvin-web.web.app` 回傳同一份檔案）。
- **後端**（Firestore / Auth / Functions / 照片 bucket）：獨立的 **`christykalvin`** 專案。
- **照片儲存**：該專案沒開通 Firebase Storage，改用自建的公開 GCS bucket `christykalvin-shop-photos`（ASIA-NORTHEAST1），由 function 首次使用時自動建立。
- **`voiceout-asia` 是共用專案**：裡面還有其他站台的 functions（`emailAdminNotification`、`generatePostTitles`、`parseStatement` 等）。
  **絕對不可以用 `--only functions` 部署**，會把本 repo 沒有的其他站台 functions 判定成要刪除。只能指名 `--only functions:importProduct,functions:uploadPhoto,functions:deletePhoto`。
- **不可覆蓋 `christykalvin.web.app` 的 live 內容**（使用者 2026-09-06 明確指示）。

## 4. 2026-09-07 解決的重大問題
- **正式站一直停在舊版本**：原因是 hosting 與 functions 寫在同一個 `firebase deploy` 指令裡，functions 端一報錯（先是「其他站台 functions 要被刪除」的確認提示，後是 artifact cleanup policy）整包指令就 exit 1，**hosting 檔案雖然已上傳，但從未完成 release**，所以線上內容停在 2026-09-06 14:16。
  修正方式：hosting 獨立成單獨一個 step 且排在最前面、加 `--force`，並在部署後自動抓正式站驗證內容，若仍是舊版就讓 CI 失敗。

## 5. Active Blockers
- **新增 3 個後台管理帳號**（`kalvin.ckw@hotmail.com`、`kalvin.ckw@gmail.com`、`pysum1025@hotmail.com`）尚未建立，等使用者提供共用密碼。
