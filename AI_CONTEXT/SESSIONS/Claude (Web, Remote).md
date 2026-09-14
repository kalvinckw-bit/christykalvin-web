# Claude (Web, Remote) - Session Record

## Identity
- **AI Agent**: Claude (Claude Code on the web / remote cloud sandbox session)
- **Host Type**: Claude Code Remote (cloud-hosted container, no access to local Windows/Mac filesystem)
- **Machine / OS**: Ephemeral Linux container (session-scoped, reclaimed after inactivity)
- **Designated Record File**: `AI_CONTEXT/SESSIONS/Claude (Web, Remote).md`

## Session History & Objectives
- **Status**: Safe to Resume
- **Last Sync**: 2026-09-14
- **Current Objective**: Brief/plan a new UGC "吐槽/辯論" (complaint & debate) feature for voiceout.asia, to be built at `public/monku.html`.

## Work Completed (做過的事情)
- Brainstormed product concept with user: a platform where users post critiques of 商品/人物/公司 topics, others take 同意/反對 sides, with hashtags, search, reputation scoring, sentiment analysis, anonymous posting, mobile support, social login, push notifications, moderation, analytics, multi-language (中/英/日).
- Discussed legal/liability framing:
  - UGC authored by platform users, not CK Holdings itself — platform is intermediary, not publisher.
  - Distinguished protected subjective opinion/reviews ("好用不好用") from risky unverified factual accusations (defamation/product disparagement exposure) — subjective feedback is low-risk; unverified accusations are the actual risk surface.
  - Flagged JAN/EAN code and company registration number identification as a way to disambiguate topics, with tradeoff: precise official binding by the platform itself may increase platform's own liability exposure (shifts from neutral tool to active curator).
- Agreed content rules to build into the spec:
  - Extreme content (personal attacks, unverified illegal accusations, hate speech, doxxing) gets removed; subjective critique/complaints are protected.
  - No uploading of existing photos/videos (to avoid image theft) — must be captured live via in-app/browser camera only (no gallery picker), with watermark/timestamp as an anti-reup deterrent.
- No code/files were written yet — this was a planning/brief-only conversation per user's explicit "我們先brief，不做" instruction earlier in the session.
- User then asked to actually build it at `voiceout.asia/monku.html`, create a folder, and set up AI context, reading from a Master AI Context Template at a **local Windows path**: `G:\マイドライブ\Projects\00 Master AI Context Template`.
- Confirmed via `firebase.json` / `.firebaserc` that this repo (`christykalvin-web`) already deploys to Firebase project `voiceout-asia`, hosting target `christykalvin-web`, public dir `public/` — so `public/monku.html` is the correct location to land at `voiceout.asia/monku.html`.
- User sent `end` mid-task (before monku.html was actually built) — this session record was created/updated as part of the mandatory `end` handoff protocol. **The monku.html build itself has NOT started.**

## Files Modified
- `AI_CONTEXT/SESSIONS/Claude (Web, Remote).md` (this file, new)
- `AI_CONTEXT/SESSIONS/REGISTRY.md` (added this session's entry)
- `AI_CONTEXT/TODO.md` (added monku.html feature to backlog)

## Next Actions / Must-Do (必須要做的事情)
1. **BLOCKER**: `G:\マイドライブ\Projects\00 Master AI Context Template` is a local Windows Google Drive path — NOT reachable from this remote cloud sandbox (no local filesystem access, no mounted drive). Whoever picks this up next needs to either:
   - Run the session from a local machine (Desktop/VS Code Claude session) that has `G:\` mounted, or
   - Have the user paste/upload the relevant Master AI Context content into the conversation or into this repo directly.
2. Once Master AI Context is available, align this project's `AI_CONTEXT/*.md` files against it (per CLAUDE.md's mandatory `start` sync instruction referencing `GROUP_GLOBAL_STATUS.md`, `DECISIONS.md`, `COMPANY_PROFILE.md`).
3. Build `public/monku.html` (or a dedicated `public/monku/` folder if the feature grows beyond one page) implementing the agreed MVP scope:
   - Topic categories (商品/人物/公司, extensible), 正反兩方留言, hashtags, camera-only photo/video capture (no upload from gallery), content moderation rules (extreme content removal), anonymous posting.
   - Defer AI-heavy features (sentiment analysis, reputation scoring, auto-summaries) to a later phase — validate with simpler mechanisms first.
4. Confirm with user: MVP topic type priority (商品 first, given lower legal risk vs 人物/公司), and whether this ships as a page within `christykalvin-web`/`voiceout-asia` hosting or a separate site/target.

## Known Risks or Blockers
- Cannot read local `G:\` drive paths from this remote session — flagged above.
- Product spec (JAN/company code binding, moderation depth, camera-capture enforcement) is agreed at a conceptual level but not yet finalized into a written spec doc — recommend writing `public/monku` feature spec before coding, given legal-sensitivity of the feature (UGC criticism of real companies/products).
