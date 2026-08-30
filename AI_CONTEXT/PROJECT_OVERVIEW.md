# Project Overview & Architecture Map

## 1. Project Summary
- **Project Name**: {{PROJECT_NAME}}
- **Core Purpose**: {{PROJECT_PURPOSE}}
- **Primary Tech Stack**: {{TECH_STACK}}
- **Target Platform**: {{TARGET_PLATFORMS}} (e.g. Web / Mobile / Desktop / Cloud API)

## 2. Directory Structure & Key Modules
```text
{{PROJECT_NAME}}/
├── src/                  # Main application source code
├── public/               # Static assets & web root
├── tests/                # Automated test suites
├── docs/                 # Documentation
└── AI_CONTEXT/           # Multi-AI SSoT Governance Framework
```

## 3. Build, Run & Verification Commands
- **Install Dependencies**: `npm install` / `pip install -r requirements.txt`
- **Development Server**: `npm run dev` / `python app.py`
- **Production Build**: `npm run build`
- **Run Tests**: `npm test` / `pytest`
- **Deploy Command**: `{{DEPLOY_COMMAND}}`

## 4. Key Architectural Boundaries
- Keep frontend UI separated from backend APIs.
- All secrets and API keys MUST be stored in `.env` (never hardcoded or committed to git).
