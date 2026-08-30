# AI Workflow & Workspace Coordination Protocol

## 1. Multi-AI Workspace Locking Rules
- Before modifying any file, the AI must check `AI_CONTEXT/SESSIONS/REGISTRY.md`.
- If a target file is marked as `Reserved` by another AI with an active heartbeat (< 30 min old), STOP and report `FILE LOCKED`.
- If an active lock is stale (> 30 min), ask the user before acquiring the lock. Never silently assume ownership.

## 2. Read-Only Safeguard on `start`
- The `start` action is strictly read-only.
- The AI must not modify source files or reserve workspaces until the user gives an explicit task instruction.
