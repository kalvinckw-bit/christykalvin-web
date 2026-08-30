# Corporate Profile & Brand Manifesto: Christy Kalvin (CK) & CK Holdings

## 1. Brand Origin & Narrative (品牌起源與故事)
> **"Built on Trust. Driven by Vision."** (始於信任，成於遠見)

**CK** 代表創辦人 **Christy & Kalvin**。
這是一段從生活伴侶、家庭信任，延伸至跨領域商業版圖的創業者故事。正如國際經典品牌（Calvin Klein、Louis Vuitton、Michael Kors）以創辦人之名象徵永恆承諾一樣，**Christy Kalvin** 代表著對品質、創新、誠信與家族資產傳承的最高標準。

- **官方全球品牌門戶**: `christykalvin.com` (ChristyKalvinWeb)

---

## 2. Corporate & Cloud Architecture (集團體系與中央雲端母架構)

```text
               🏛️ 【CK Holdings (頂層控股母公司 / 雲端母專案)】
               （持有 christykalvin.com 品牌 IP、核心股權、家族信託與重大資產）
               （Firebase Master Project: CK Holdings / Project ID: voiceout-asia）
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
  📣 【Voice Out】             🛍️ 【Sougu】                 ✨ 【ChristyKalvin】
  (已正式營運 / SaaS 業務)    (Crosspath 偶遇社群/電商)    (全球品牌官方門戶)
  - 域名: voiceout.asia        - 域名: sougu.online         - 域名: christykalvin.com
  - DB: (default)              - DB: sougu-db               - DB: christykalvin-db
```

### 🏆 雲端技術與身分統一原則 (SSoT Cloud & Auth Principles)：
1. **集團一號通（Unified Authentication）**：
   - 全集團所有網站與產品一律共用 **CK Holdings Master Firebase Authentication**。
   - 用戶只需在任一網站註冊一次，即可通行全集團旗下所有服務（同一 UID），絕不讓用戶重複註冊。
2. **多資料庫隔離（Multi-Database Partitioning）**：
   - 共享同一 Master Project 的 Blaze 方案，但各業務資料庫獨立分開：
     - `(default)`: Voice Out Web / App 專用
     - `sougu-db`: Sougu (Crosspath) 專用
     - `christykalvin-db`: ChristyKalvin 官方專用
     - `creditcard`: 信用卡/金流模組專用
     - `dead-man-switch`: 死人開關安全模組專用
3. **多站點託管（Multi-Site Hosting）**：
   - 所有品牌網域皆在同一母專案下以獨立 Hosting Site 進行管理與綁定。

---

## 3. Core Philosophy & Values (核心理念)
1. **守護與傳承 (Legacy & Stewardship)**: 打造跨越世代、保護家族資產的長青基業。
2. **極致與品味 (Excellence & Elegance)**: 任何產品、網站或實體服務，皆以國際大牌的嚴苛標準追求美感與體驗。
3. **科技與溫度 (Innovation with Soul)**: 用 AI 和前沿技術賦能商業，以人與家庭為核心本位。
