# 系統模組地圖（System Map）

一個輕量的 2D 系統視覺化與協作工具。可切換系統版本、以不限層數的父子模組描述包含關係、另外指定模組資料流上下游、追蹤各暫存實例的資料量與溝通主題，並將目前版本匯出為 Markdown、HTML 或 JSON，或完整備份及還原資料庫。

> [!IMPORTANT]
> 這份系統資訊預設應視為內部資料。OpenAI Sites 上的既有專案是私有設定；若改用自己的 Cloudflare 帳號部署，`workers.dev` 網址若沒有 Cloudflare Access 保護，可能可由外部連線。請先完成本文的「私有存取」設定，再執行正式部署。

## 主要功能

- 切換不同系統版本，立即顯示該版本的模組、暫存空間與主題；系統名稱、版本名稱、時間、狀態及說明也可編輯。
- 點選模組後新增、修改主題內容，並標示為「草稿」、「討論中」或「已 Review」。
- 直接修改模組名稱、代碼、說明、健康狀態及識別色，變更同步反映在地圖與匯出文件。
- 新增與編輯暫存空間的名稱、數量、類型及補充資訊；例如名稱 `A`、數量 `5` 會展開為 `A1`～`A5`，並可分別記錄每個實例的資料筆數。
- 狀態圖中的暫存空間預設只顯示群組、實例與資料總數；使用者可按需展開，再以杯子與球查看每個實例的精確數量。
- 模組可遞迴包含子模組，資料結構不限制層數；可指定其他模組為上層、升為根層，或新增同層／子模組，介面可沿麵包屑逐層瀏覽。
- 包含關係與資料流分開管理；可為任一模組新增上游、下游與傳遞內容。視覺區會以目前模組為中心，將上游置於上方、下游置於下方，並用帶有傳遞內容的動態箭頭呈現方向；點擊節點即可重新聚焦。
- 多人共享同一份資料，不區分編輯者；頁面每 5 秒同步，並以 revision 避免靜默覆蓋較新的內容。
- 匯出目前版本的 Markdown、HTML 或 JSON 報表；另可匯出可無損還原的完整資料庫備份。
- 匯入完整資料庫備份時，可選擇取代目前資料庫，或從備份挑選單一版本、指定新的版本名稱後加入現有系統；匯入的節點與資料流識別碼會重新建立，避免與現有版本衝突。
- 搜尋模組或暫存實例，並依模組健康狀態篩選。

## 環境需求與相依套件

- Node.js `22.13.0` 以上
- npm（隨 Node.js 安裝）
- 自行部署時：Cloudflare 帳號、Workers 與 D1 使用權限

直接相依套件與版本完整列在 [`package.json`](./package.json)，精確解析版本鎖定於 [`package-lock.json`](./package-lock.json)。請使用 `npm ci`，不要以全域安裝取代專案套件。

主要技術如下：

- React 19、Vinext、Vite：前端與 Cloudflare Worker 建置。
- Cloudflare Workers、D1、Wrangler：服務端 API、共享資料與部署。
- Drizzle Kit / ORM：D1 schema 與 migration 定義。
- Base UI、shadcn、Lucide：互動元件與圖示。
- Tailwind CSS、專案 CSS：樣式建置。
- TypeScript、Oxlint、Oxfmt：型別、檢查與格式化。

## 本機啟動

安裝精確鎖定的套件並啟動開發伺服器：

```powershell
npm ci
npm run dev
```

終端機會顯示本機網址，通常是 `http://localhost:3000`。開發環境若尚未初始化 D1，API 會退回程序記憶體模式；畫面會顯示「本機預覽模式」，重新啟動服務後資料會消失，且無法供不同裝置共享。

驗證正式建置與 Worker 本機預覽：

```powershell
npm run build
npm start
```

`npm start` 使用建置後的 `dist/server/wrangler.json`。若只做介面開發，使用 `npm run dev` 即可。

## 資料與專案結構

- `app/page.tsx`：系統地圖、編輯、同步與匯出介面。
- `app/api/map/route.ts`：共享狀態 API 與 revision 衝突處理。
- `db/schema.ts`：D1 資料表定義。
- `drizzle/`：必須套用到 D1 的 SQL migrations。
- `.openai/hosting.json`：既有 OpenAI Sites 專案與 `DB` binding；不要把其他專案的 ID 覆蓋進來。
- `scripts/prepare-cloudflare-deploy.mjs`：將自己的 Worker 名稱與 D1 ID 寫入每次 build 重新產生的 Wrangler 設定。

目前共享資料以一筆 JSON 狀態保存在 `system_map_state`。這適合「所有人共同維護同一張圖」的輕量使用方式；並行寫入衝突時，後送出的舊 revision 會收到 `409`，介面會載入較新的內容。它不是逐欄位合併或 CRDT 協作編輯器。

## 使用既有 OpenAI Sites 私有部署

專案已由 `.openai/hosting.json` 連結到既有 Sites 專案，且資料庫 binding 名稱是 `DB`。在 Codex 中要求「以私有權限發布目前專案」即可建置並發布；不要自行改動 `project_id`。發布後仍應確認存取名單只有預期的帳號。

若要完全由自己的 Cloudflare 帳號維運，使用下一節的流程。

## 自行部署到 Cloudflare（保持私有）

### 1. 先建立私有存取防線

在 Cloudflare Zero Trust 啟用 Access，並在任何正式部署之前開啟帳號層級的 Workers 保護（例如 Protect all Workers / Require Access protection）。建立 Allow policy，只允許你的 email 或組織身分；不要建立 Everyone / Bypass 規則。

如果你的帳號無法在部署前強制保護所有 Workers，請先不要執行 `wrangler deploy`，改用既有的私有 OpenAI Sites 部署，直到存取政策準備完成。

### 2. 登入並建立 D1

```powershell
npx wrangler login
npx wrangler d1 create system-map
```

保留輸出中的 `database_id` UUID；它是資源識別碼，不是登入密碼，但仍不需要公開張貼。

### 3. 建置並產生自己的 Cloudflare 設定

PowerShell：

```powershell
npm ci
npm run build
$env:SYSTEM_MAP_D1_DATABASE_ID = "<上一個步驟取得的 UUID>"
$env:SYSTEM_MAP_D1_DATABASE_NAME = "system-map"
$env:SYSTEM_MAP_WORKER_NAME = "system-map"
npm run configure:cloudflare
```

Bash / zsh：

```bash
npm ci
npm run build
export SYSTEM_MAP_D1_DATABASE_ID="<上一個步驟取得的 UUID>"
export SYSTEM_MAP_D1_DATABASE_NAME="system-map"
export SYSTEM_MAP_WORKER_NAME="system-map"
npm run configure:cloudflare
```

每次重新執行 `npm run build` 後，都要再執行一次 `npm run configure:cloudflare`，因為 build 會重新產生 `dist/server/wrangler.json`。

### 4. 套用 migration

```powershell
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
```

第一次執行會建立 `system_map_state`。若 migration 沒有成功，不要繼續部署；否則線上 API 會退回單一 Worker instance 的記憶體狀態，資料不可靠。

### 5. 部署 Worker

```powershell
npx wrangler deploy --config dist/server/wrangler.json
```

部署完成後：

1. 用允許的帳號開啟網址，確認可進入系統。
2. 用未登入的無痕視窗測試，必須先看到 Access 驗證或拒絕頁，不能直接看到系統地圖。
3. 在兩個已授權視窗修改資料，確認數秒內同步。
4. 在 Cloudflare D1 主控台確認 `system_map_state` 已有資料。

後續更新需重跑：

```powershell
npm ci
npm run build
npm run configure:cloudflare
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
npx wrangler deploy --config dist/server/wrangler.json
```

同一個 PowerShell 視窗中，前述三個 `SYSTEM_MAP_*` 環境變數會繼續存在。新的終端機需重新設定。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run lint` | 執行靜態檢查 |
| `npm run build` | 產生 Worker 建置輸出 |
| `npm start` | 本機預覽建置後的 Worker |
| `npm run configure:cloudflare` | 將自己的 Worker / D1 設定寫入建置產物 |

## 備份與還原

一般使用者可直接從頁面右上角的「匯出」選單下載「完整資料庫備份」，再以「匯入備份」還原。匯入提供兩種模式：

- 「新增為系統版本」會保留目前資料，從備份挑選一個版本，並要求指定匯入後的版本名稱。
- 「完整取代目前資料庫」會還原備份中的系統名稱與所有版本；執行前應先下載目前資料庫備份。

匯入會驗證版本、模組、暫存空間、主題與資料流結構，並拒絕超過資料庫 500 KB 上限的內容。舊版「完整系統 JSON 報表」也可作為匯入來源。

管理者在大量修改或升級前，也可用 Wrangler 匯出底層 D1 SQL 備份：

```powershell
npx wrangler d1 export DB --remote --config dist/server/wrangler.json --output system-map-backup.sql
```

備份可能包含完整內部系統資訊，請存放在受控位置，且不要提交到 Git。匯出的 Markdown、HTML 與 JSON 也可能含敏感資料，分享前應套用相同的權限規則。

## 已知限制

- 不記錄編輯者，也沒有欄位級權限、簽核者或稽核軌跡。
- 多人同步採 5 秒輪詢與整份狀態 revision，不會合併同一時間的不同欄位變更。
- 本機記憶體模式不會持久化。
- HTML 匯出是可攜式靜態文件；開啟後不會連回系統同步。
- 模組資料結構可無限巢狀，但極深層級仍會受瀏覽器版面與可讀性限制。
- `npm run lint` 目前也會掃描專案隨附、但未必被本頁使用的 shadcn 元件，會回報既有的 accessibility / React compiler 規則錯誤；正式建置不受影響。若要把 lint 當成 CI gate，應先清理未使用元件或調整規則範圍。

## Git 版本控管

原始碼、migration、README、`package.json` 與 `package-lock.json` 應提交；`node_modules/`、`dist/`、本機環境變數與含內部資料的備份不應提交。正式部署前可先執行：

```powershell
git status
npm run build
```
