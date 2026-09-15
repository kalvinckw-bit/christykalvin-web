## ⚡ Step 9: Mandatory Git Commit & Push to Cloud (收工強制推送雲端)
**AI 必須自動依序執行（嚴禁要求使用者手動執行！）：**
1. `git add -A`（納入自身 session 檔、REGISTRY.md、TODO.md 及修改的程式碼）
2. `git commit -m "..."`
3. `git pull --rebase origin <branch>`
4. `git push origin <branch>`
**確認輸出中包含遠端 push 成功訊息，並在交接報告中附上 Commit Hash！**

# Reusable Action: end (Master Handoff & Auto-Sync Protocol)

Triggered whenever the user says `end` or requests to finish/hand off the session.

---

## Mandatory Automated Handoff Steps:

1. **Review Session Work**:
   - Run `git status` and `git diff --stat` to inspect all files created or modified.

2. **Update Designated Session File**:
   - Open ONLY your own file in `AI_CONTEXT/SESSIONS/[AI Name] ([Host], [OS]).md`.
   - Record:
     - Work Completed in this session.
     - Files modified.
     - Mandatory Next Steps / Must-Do actions for the next AI session.
     - Known risks, blockers, or unverified items.
     - Timestamp and Status (Completed / Safe to Resume).

3. **Update Master Coordination Files**:
   - Update `AI_CONTEXT/SESSIONS/REGISTRY.md` with your latest heartbeat and state.
   - Update `AI_CONTEXT/CURRENT_STATUS.md` and `AI_CONTEXT/TODO.md` if milestones were completed.

4. **Automatic Git Commit & Push (Mandatory)**:
   - Execute: `git add .`
   - Execute: `git commit -m "chore(session): update session records and handoff state"`
   - Execute: `git pull --rebase`
   - Execute: `git push origin <current-branch>`
   - *Conflict Safety*: If push is rejected due to remote updates, retry rebase once. If conflict occurs in source code, report conflict to user immediately.

5. **Google Drive Mirror Sync (全集團專案 Google Drive 鏡像同步)**:
   - 全集團專案在 Google Drive 皆有對應實體鏡像（本專案鏡像為 `G:\マイドライブ\Projects\ChristyKalvinWeb`），無任何自動 webhook 或排程機制，必須由 AI 在收工時執行：
     1. 執行 `git diff --name-only <上次同步commit>..HEAD` 或實體檢查找出本次 session 異動檔案清單。
     2. 將異動檔案同步更新/複製至 Google Drive 該專案根目錄鏡像對應路徑。
        - ⚠️ **Web / 雲端沙盒環境安全防護**：在無本地掛載磁碟（無 `G:\` 實體路徑）之雲端/Web AI 環境（如 Web 或手機端 Claude）中，**嚴禁調用 Google Drive API 執行破壞性的「刪除檔案（Trash）再重新建立」**！Web 端 AI 收工時只需確保代碼正確 `git add`、`git commit` 並 `git push` 至 GitHub 遠端倉庫；本機桌端（Antigravity）會負責實體磁碟目錄的 1:1 秒級鏡像同步與還原。
     3. 在收工交接報告（SESSION HANDOFF）中，明確列出「這次同步了哪些檔案、對應到 Drive 哪個路徑或 GitHub Commit」，嚴禁只寫「已同步」三個字，嚴禁省略。
     4. 嚴禁跳過這一步，嚴禁假設「應該最新」。

6. **Output Standard Handoff Report**:
   - Output the exact summary format below:

```
=== SESSION HANDOFF ===

AI Agent
[Your AI Name] ([Desktop/VS Code], [Windows/MacBook])

Current Branch & Commit
[Branch Name] @ [Commit Hash]

Work Completed (做過的事情)
- [Detail 1]
- [Detail 2]

Google Drive Sync Status (Drive 鏡像同步狀態)
- [有本地磁碟掛載的環境：列出同步檔案清單與對應 Drive 檔案 ID。
   無本地磁碟掛載的 Web/雲端環境：改列出本次 GitHub commit hash，
   並註明「本機桌端 Antigravity 會負責實體磁碟目錄鏡像同步」，嚴禁只寫「已同步」]

Next Actions / Must-Do (必須要做的事情)
- [Must-Do 1]
- [Must-Do 2]

Known Risks or Blockers
- [None or specific blockers]

Git Sync Status
Pushed to GitHub remote successfully.

Safe to Resume on Another Computer
YES
```
