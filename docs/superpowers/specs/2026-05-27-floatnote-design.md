# NotePet — 浮動筆記視窗設計規格

**日期：** 2026-05-27
**狀態：** 已核准

---

## 一、功能概述

在現有的筆記面板（panel）上疊加兩項改動：

1. **筆記卡片重新設計**：顯示內容預覽、建立日期，並以左側金色邊線為視覺分隔。
2. **浮動編輯視窗**：雙擊卡片或按「新增」時，在桌面上彈出可自由拖移的便利貼視窗，多張可同時並排開啟。

---

## 二、筆記卡片新樣式

### 視覺規格

| 元素 | 描述 |
|---|---|
| 左邊框 | `3px solid #f0c040`，無圓角 |
| 底部分隔線 | `1px solid #f0e8a0` |
| 標題列 | 粗體 13px，右側顯示建立日期（`M月D日`，灰色 10px） |
| 內容預覽 | 12px，`-webkit-line-clamp: 3`，最多 3 行，超過截斷 |
| 標籤＋提醒 | 底部 meta 行，11px 灰色 |
| 刪除鈕 | 預設 `opacity: 0`，hover 時顯示，點擊刪除（現有行為） |
| 互動 | 單擊無動作；**雙擊**開啟浮動編輯視窗 |

### 日期顯示來源

優先使用 `note.createdAt`（ISO 字串）；新建筆記在 `addNote()` 時自動加入此欄位。現有舊筆記無 `createdAt` 則不顯示日期。

---

## 三、浮動編輯視窗

### 觸發方式

- **雙擊**面板裡的筆記卡片
- **點擊**「新增」按鈕（建立新筆記後立即開啟）

### 視覺規格

```
┌─────────────────────────────┐  ← 標題列（金色 #f0c040，cursor:move）
│ 筆記標題文字            ×  │
├─────────────────────────────┤
│                             │
│  textarea（內容，可垂直拉大）│
│                             │
├─────────────────────────────┤
│ [生活] [工作] [學習]        │  ← 標籤 pills
├─────────────────────────────┤
│ ⏰ toggle  2026-06-01 09:00 │  ← 提醒（含重複間隔、提前分鐘）
├─────────────────────────────┤
│              [取消]  [儲存] │
└─────────────────────────────┘
```

- 寬度：`280px`（預設）
- 背景：`#fffde7`，邊框 `1px solid #f0c040`，圓角 `10px`
- 陰影：`0 6px 24px rgba(0,0,0,.35)`
- `position: fixed`，初始位置：螢幕中央偏上，每次新開位置加 `(20px, 20px)` offset 避免完全重疊

### 拖移實作

- `mousedown` 在標題列觸發，`mousemove` / `mouseup` 在 `document`
- 邊界限制：視窗四邊至少留 10px 在螢幕內

### setIgnoreMouse 互動

現有 `mousemove` handler 在 `panelOpen === false` 時會依游標下的元素自動切換 `setIgnoreMouse`。浮動視窗開啟時必須同樣抑制此自動切換，否則游標離開浮動視窗元素移到透明區域時會觸發 `setIgnoreMouse(true)`，導致拖移中斷。

**實作方式：** `mousemove` handler 的判斷條件從 `if (panelOpen) return` 改為 `if (panelOpen || floatNoteMap.size > 0) return`。浮動視窗全部關閉後（`floatNoteMap` 為空），自動切換邏輯恢復正常。

### 多張並排

- `floatNoteMap`：`Map<noteId, HTMLElement>`，追蹤目前開啟的浮動視窗
- 同一張筆記雙擊兩次：不重複建立，呼叫 `bringToFront(el)` 將已存在的視窗 `zIndex` 提升到最高
- **z-index**：浮動視窗從 `1000` 開始，每次 `bringToFront` 使用遞增計數器（`floatZCounter`）；面板 `z-index: 20`，overlay `z-index: 10`，不衝突
- 沒有開啟上限（由使用者自行管理）

### 初始位置 offset

- 基準點：`{ x: window.innerWidth/2 - 140, y: 80 }`（寬 280px 故 -140 置中）
- 每次新開視窗加 `(20px, 20px)` offset
- 若下一個位置會使視窗超出螢幕邊界（扣 10px margin），重置回基準點

### 按鈕行為

| 按鈕 | 行為 |
|---|---|
| 儲存 | 呼叫 `saveNote()` 存檔，關閉視窗 |
| 取消 / × | 放棄變更，關閉視窗；若 `isNew === true` 且**輸入欄位**（`titleInput.value` 與 `contentInput.value`）皆為空，從 `state.notes` 移除該筆記 |

> **說明**：`addNote()` 建立筆記物件時 `title` / `content` 仍為空字串，直到「儲存」才寫入 state。因此取消時必須檢查 DOM 輸入欄位值，而非 `note.title` / `note.content`。`openFloatNote` 接受 `isNew` 參數（boolean）以區分新建 vs 編輯既有筆記。

### 提醒區塊

與現有 `buildNoteEditor` 的提醒 UI 相同：toggle switch、`datetime-local`、重複間隔 select、提前分鐘 number input。

---

## 四、互動模型

| 操作 | 結果 |
|---|---|
| 雙擊筆記卡片 | 開啟浮動視窗 |
| 按「新增」 | 建立新筆記 + 立即開啟浮動視窗 |
| 浮動視窗「儲存」 | 存檔 + 關閉視窗 |
| 浮動視窗「取消」或 × | 放棄變更 + 關閉；空新建筆記則刪除 |
| `Escape` | 關閉面板；浮動視窗維持開啟 |
| 同筆記雙擊兩次 | 已存在的視窗移到最前，不重複建立 |

---

## 五、受影響的檔案

| 檔案 | 變更類型 |
|---|---|
| `renderer/app.js` | 主要變更：移除 `editingNoteId` 與 `buildNoteEditor`；重寫 `buildNoteCard`；新增 `openFloatNote(note, isNew)`、`formatCardDate`、`floatNoteMap`、`floatZCounter`；`addNote()` 加入 `createdAt: new Date().toISOString()`；`mousemove` handler 判斷條件加入 `floatNoteMap.size > 0`；移除 `closePanel` 的 `editingNoteId` guard（面板可在浮動視窗開啟時自由關閉，與 Escape 行為一致） |
| `renderer/style.css` | 新增：`.note-card` 重構、`.floatnote-*` 樣式 |

---

## 六、不在範圍內

- 浮動視窗位置持久化（不儲存到 `notes.json`）
- 浮動視窗尺寸拖改（固定寬度）
- 多螢幕支援
