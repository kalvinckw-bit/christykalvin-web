
> [!IMPORTANT]
> ### 👑 核心啟動指令：開局必讀集團 Master AI Context（Master SSoT Sync）
> **每次執行 `start` 或開啟新 Session 時，AI 必須首先讀取 Master AI Context，以對齊最新的集團架構與全域政策：**
> 1. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\GROUP_GLOBAL_STATUS.md`（集團中央總指揮儀表板）
> 2. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\DECISIONS.md`（集團最高決策記錄）
> 3. 📖 `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\COMPANY_PROFILE.md`（集團統一企業畫像）
> **對齊集團最新指示後，方可繼續執行本地專案之 `AI_CONTEXT/START_SESSION.md`！**

# Universal AI Agent Governance Protocol (Master SSoT)
> [!CAUTION]
> ### ⚡ AI 行動憲法：主動自主執行原則（Zero Homework for User）
> **AI 必須自主調用工具完成所有可自動化之任務（CLI、雲端開通、腳本、代碼、Git），嚴禁將 AI 有權限執行的操作推給用戶手動點擊或手動修改！**
> 只有真人 2FA 驗證或重大商業決策才可向用戶請求。

> [!IMPORTANT]
> ### 🏆 核心治理背景：多 AI 輪替與跨平台「接力棒（Relay Handover）」系統
> **本專案的核心工作流哲學：**
> 1. **多 AI 輪替開發（Quota Exhaustion Fallback）**：開發者會在多個 AI（Claude、Google Antigravity、ChatGPT、Codex）之間頻繁切換，以因應各平台用量配額（Quota）耗盡或工具特性。
> 2. **跨平台開發（Cross-Platform Mobility）**：開發者會在不同設備（Windows 工作站、MacBook 筆電、Web 雲端）之間移動作業。
> 3. **無縫接力棒交接（Relay Baton Protocol）**：因為不同 AI 與平台之間「不會自動即時同步」，所以每一位 AI 必須嚴格執行 **`start`（接棒/對齊最新雲端進度）** 與 **`end`（交棒/紀錄做過與必做事項並自動 Push）**，確保下一位接手的 AI 隨時能 100% 無縫接續，絕不拿舊代碼覆蓋新代碼！

This project uses the unified Multi-AI Single Source of Truth (SSoT) governance framework.
All AI assistants (Antigravity, Claude Code, ChatGPT, Codex, Cursor, Gemini) collaborating on this codebase MUST strictly comply with these rules.

## Core Mandates:
1. **Mandatory Lifecycle**:
   - Begin every session by executing `start` as defined in [AI_CONTEXT/START_SESSION.md](AI_CONTEXT/START_SESSION.md).
   - End every session by executing `end` as defined in [AI_CONTEXT/END_SESSION.md](AI_CONTEXT/END_SESSION.md).
2. **Identity & Record Isolation**:
   - Identify your exact environment upon startup (`[AI Name] ([Host: Desktop / VS Code], [Device: Windows / MacBook])`).
   - Own, read, and write ONLY your designated session file in `AI_CONTEXT/SESSIONS/`. Never edit another AI's session file.
3. **Single Source of Truth (SSoT)**:
   - The `AI_CONTEXT/` directory is the single source of truth for project architecture, active status, decisions, and todos.
4. **Fact vs. Inference Distinction**:
   - If a feature or integration is not proven by live run logs or direct file inspection in the current session, it MUST be labeled as `[Inferred from code, not yet verified]`. Never present assumptions as verified facts.
5. **Decisions are Permanent**:
   - `AI_CONTEXT/DECISIONS.md` records permanent architectural and design decisions. Never revert or re-debate approved decisions without explicit user instruction.
6. **Automatic Git Synchronization**:
   - `start` automatically performs `git pull --rebase` to ensure latest code.
   - `end` automatically commits and pushes the session records and code changes to the remote repository.


> [!NOTE]
> ### 🛡️ 用戶情報採集規範（Maximum Telemetry Policy）
> **所有前端專案在用戶登入與會話中，必須透過 ck-telemetry.js 自動採集用戶全部可獲取之情報（IP、Geo、Device、OS、螢幕、CPU/RAM、語言、時區、來源），並即時寫入 Firestore users/{uid}/telemetry_logs。**


### Action: sync (或 sync master)
當使用者在對話途中輸入 sync 或 sync master 時：
1. **立即重新讀取 Master SSoT**：
   - 📖 C:\\Users\\kalvi\\OneDrive\\Projects\\00 Master AI Context Template\\AI_CONTEXT\\GROUP_GLOBAL_STATUS.md
   - 📖 C:\\Users\\kalvi\\OneDrive\\Projects\\00 Master AI Context Template\\AI_CONTEXT\\DECISIONS.md
   - 📖 C:\\Users\\kalvi\\OneDrive\\Projects\\00 Master AI Context Template\\AI_CONTEXT\\COMPANY_PROFILE.md
2. 比對是否有最新集團決策、全域架構或基礎設施變更。
3. 在當前對話中即時套用最新政策（不中斷、不關閉 Session）。
4. 簡短回報：=== MASTER SYNC COMPLETED === 與對齊之最新變更要點。