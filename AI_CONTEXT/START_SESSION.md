## ⚡ Step 0.1: Mandatory Git Pull from Cloud (開局強制同步雲端)
**AI 必須首先執行：**
```bash
git pull --rebase origin <current-branch>
```
將 GitHub 雲端其他 AI 或其他裝置最新推上去的代碼與 SSoT 同步到本機，確保工作區絕對處於最新狀態！


## Step 0: Mandatory Master AI Context Alignment (開局對齊集團主中樞)
Before reading local files, inspect the Group Master SSoT:
1. Read `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\GROUP_GLOBAL_STATUS.md`
2. Read `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\DECISIONS.md`
3. Read `C:\Users\kalvi\OneDrive\Projects\00 Master AI Context Template\AI_CONTEXT\COMPANY_PROFILE.md`

# Reusable Action: start (Master Onboarding Protocol)

Triggered whenever the user says `start` or requests to begin working.

---

## Mandatory Automated Startup Steps:

1. **Identify Self**:
   - Determine current tool, IDE host (Desktop App vs VS Code), and OS (Windows vs MacBook).
   - Match to designated session file: `AI_CONTEXT/SESSIONS/[AI Name] ([Host], [OS]).md`.

2. **Git Synchronization**:
   - Execute: `git fetch --all`
   - Execute: `git pull --rebase`
   - Execute: `git status` and `git branch`
   - Verify working tree is clean.

3. **Read Context Documents in Order**:
   - Read `AI_CONTEXT/PROJECT_OVERVIEW.md`
   - Read `AI_CONTEXT/CURRENT_STATUS.md`
   - Read `AI_CONTEXT/TODO.md`
   - Read `AI_CONTEXT/DECISIONS.md`
   - Read own session file in `AI_CONTEXT/SESSIONS/`

4. **Output Fast Briefing to User**:
   - State your identified AI identity and current Git branch.
   - Summarize: What was completed in the last session.
   - Summarize: Next priority tasks from `TODO.md` / `CURRENT_STATUS.md`.
   - Conclude with: "Ready for your instructions."
