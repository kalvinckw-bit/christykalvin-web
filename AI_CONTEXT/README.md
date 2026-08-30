# AI Context: Master Entry Point

> [!IMPORTANT]
> ### 🏆 核心治理背景：多 AI 輪替與跨平台「接力棒（Relay Handover）」系統
> **本專案的核心工作流哲學：**
> 1. **多 AI 輪替開發（Quota Exhaustion Fallback）**：開發者會在多個 AI（Claude、Google Antigravity、ChatGPT、Codex）之間頻繁切換，以因應各平台用量配額（Quota）耗盡或工具特性。
> 2. **跨平台開發（Cross-Platform Mobility）**：開發者會在不同設備（Windows 工作站、MacBook 筆電、Web 雲端）之間移動作業。
> 3. **無縫接力棒交接（Relay Baton Protocol）**：因為不同 AI 與平台之間「不會自動即時同步」，所以每一位 AI 必須嚴格執行 **`start`（接棒/對齊最新雲端進度）** 與 **`end`（交棒/紀錄做過與必做事項並自動 Push）**，確保下一位接手的 AI 隨時能 100% 無縫接續，絕不拿舊代碼覆蓋新代碼！


Welcome to the project context directory. This directory serves as the unified Single Source of Truth (SSoT) for all AI assistants.

> [!IMPORTANT]
> - Every new AI session must begin with [START_SESSION.md](START_SESSION.md).
> - Every AI session must end with [END_SESSION.md](END_SESSION.md).
> - No user prompt copy-pasting is required. The user initiates sessions simply by typing `start` and closes sessions by typing `end`.

---

## Mandatory Reading Sequence on Startup:
1. **[START_SESSION.md](START_SESSION.md)**: Auto-detects identity, runs `git pull --rebase`, and validates working copy.
2. **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)**: Architecture map, tech stack, directory structure.
3. **[CURRENT_STATUS.md](CURRENT_STATUS.md)**: Current development phase, active features, verified vs unverified items.
4. **[TODO.md](TODO.md)**: Prioritized task list.
5. **[DECISIONS.md](DECISIONS.md)**: Permanent constitutional project rules and architecture decisions.
6. **`AI_CONTEXT/SESSIONS/[Your AI Identity].md`**: Your designated session history and last known state.
7. **[SESSIONS/REGISTRY.md](SESSIONS/REGISTRY.md)**: Central active multi-AI roster and heartbeat coordination.
