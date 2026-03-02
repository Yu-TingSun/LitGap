# Changelog 新增條目 — v2.0.1

貼到 Changelog.md 最頂部（[1.2.4] 之前）

---

## [2.0.1] - 2026-03-02

### Fixed
- **API Key 每次都要重新輸入的 Bug（核心修復）**
  - 根本原因：`aiClient.js` 的 Pref key 命名空間錯誤
  - 舊版儲存用 `extensions.litgap.*`，Zotero 8 要求完整前綴 `extensions.zotero.litgap.*`
  - 導致 `createFromPrefs()` 每次讀取都找不到儲存的 Key，回傳 null，觸發重新輸入
  - 修正後：Key 只需第一次設定，之後自動讀取

### Changed
- **Reset 偏好設定改為分步驟 checkbox 選擇**
  - 舊版：一個確認按鈕，只能全部重置
  - 新版：兩步驟對話框，分別選擇：
    - Step 1：重置各 collection 的「Don't ask me again」確認設定
    - Step 2：清除已儲存的 AI API Key 與 Provider
  - 可以只重置其中一項，或兩項都重置

### Added
- **右鍵菜單消失的處理提示**
  - 在 Reset 第二步驟對話框中加入提示文字
  - 在 Reset 完成通知中重複顯示
  - 提示內容：「若右鍵菜單在重啟 Zotero 後消失，請前往 Tools > Add-ons，Disable 再 Enable LitGap」

### Technical
- `aiClient.js` v2.0.1：新增 `PREF_PREFIX` 常數集中管理命名空間；`clearApiKey()` 現在同時清除 provider/model/baseUrl
- `overlay.js` v2.0.1：`resetPreferences()` 全面重寫為兩步驟 checkbox 流程
- `manifest.json`：版本號 2.0.0 → 2.0.1
