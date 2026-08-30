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

5. **Output Standard Handoff Report**:
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
