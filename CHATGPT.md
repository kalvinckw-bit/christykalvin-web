> [!CAUTION]
> ### ⚡ 嚴禁狹隘單點修改原則（Anti-Silo & Cross-AI Realignment Mandate）
> **任何 AI 新增或修訂任何規則時，嚴禁只改自己專屬的檔案（例如 Claude 嚴禁只改 `CLAUDE.md`）！**
> **必須同時同步更新全套入口公文：`AGENTS.md`、`CLAUDE.md`、`CHATGPT.md`、`DECISIONS.md` 與對應的 `START_SESSION.md` / `END_SESSION.md`！誰發明或修訂規則，誰就必須負全責同步傳達給全體 AI 入口！**

> [!CAUTION]
> ### ⚡ 鋼鐵憲法：開局必 Pull，收工必 Push（Mandatory Git Cloud Sync）
> **1. 任何 AI 執行 `start` 時，第一動作必須自動執行 `git pull --rebase` 拉取 GitHub 雲端最新代碼！**
> **2. 任何 AI 執行 `end` 時，必須自動執行 `git add`、`git commit` 並立即 `git push` 推上 GitHub 雲端！**
> **3. 嚴禁任何 AI 宣稱『不需要 push 到 GitHub』或將 push/pull 留給使用者手動！自動同步雲端是 AI 的基本職責！**
> **4. 全集團專案 Google Drive 鏡像同步鋼鐵憲法（Universal Google Drive Mirror Sync on End）：**
>    - **全集團所有專案在 Google Drive 均有對應實體鏡像目錄（本專案鏡像為 `G:\マイドライブ\Projects\ChristyKalvinWeb\`）。此同步並非自動，沒有任何 webhook 或排程機制，完全由 AI 每次收工時自主執行！**
>    - **任何 AI 執行 `end` 時，必須：**
>      1. **找出本次 Session 改動過的所有檔案（例如使用 `git diff --name-only <上次同步commit>..HEAD` 或實體狀態比對）。**
>      2. **把每一個改動過的檔案同步更新/上傳至 Google Drive 該專案之根目錄鏡像對應路徑（`G:\マイドライブ\Projects\ChristyKalvinWeb\...`，若在無本地磁碟掛載之環境如 Web Claude，則調用 Google Drive API 上傳）。**
>      3. **在收工交接報告（SESSION HANDOFF）中，明確列出「這次同步了哪些檔案、對應到 Drive 哪個路徑或檔案 ID」，嚴禁只寫「已同步」三個字，嚴禁省略！**
>      4. **嚴禁跳過這一步、嚴禁假設「應該還是最新的」——忘記檢查=雲端鏡像停擺！**

> [!CAUTION]
> ### ⚡ AI 嚴禁怠惰與推卸責任原則（Zero Lazy Delegation & Strict Self-Execution）
> 1. **嚴禁將自動化工作推給用戶（Zero Homework）**：
>    - 嚴禁詢問「需要我現在幫你建 repo 嗎？還是你自己處理？」等推諉發言！
>    - 遇到 Git Remote 未設定、環境缺失、依賴未安裝時，AI 必須**自主使用 gh repo create、CLI 工具或腳本直接修復並 Push 完畢**，絕不可叫用戶「自己處理」！
> 2. **嚴禁跨目錄誤判（Strict Directory Isolation）**：
>    - 操作任何子專案前，必須明確以該專案為工作目錄（或使用 git -C <路徑>），嚴禁因 CLI 所在工作目錄錯誤而誤判專案狀態！
> 3. **嚴禁未經真實工具檢查之幻覺（Fact-First & Zero Hallucination）**：
>    - 任何宣稱「無 remote」、「無法 push」前，必須先以工具真實查詢，絕不允許憑空猜測！


> [!IMPORTANT]
> ### 👑 核心啟動指令：開局必讀集團 Master AI Context（Master SSoT Sync）
> **每次執行 `start` 或開啟新 Session 時，AI 必須首先讀取 Master AI Context，以對齊最新的集團架構與全域政策：**
> 1. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\GROUP_GLOBAL_STATUS.md`（集團中央總指揮儀表板）
> 2. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\DECISIONS.md`（集團最高決策記錄）
> 3. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\COMPANY_PROFILE.md`（集團統一企業畫像）
> **對齊集團最新指示後，方可繼續執行本地專案之 `AI_CONTEXT/START_SESSION.md`！**

﻿

- **中途同步指令 (sync / sync master)**：當用戶在 Session 進行中輸入 sync 或 sync master，AI 必須立即重新讀取 GROUP_GLOBAL_STATUS.md 與 Master DECISIONS.md，即時更新大腦決策！