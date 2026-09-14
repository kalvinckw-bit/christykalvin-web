# 訊號偵測（Signal Scout）建置與啟用說明

以 GPS 精準位置記錄雙卡（主卡 / 副卡）訊號強度，並在網站地圖上呈現。

## 為什麼一定要 App

瀏覽器沒有任何 API 可以讀取蜂巢訊號強度（dBm / 格數），也無法得知手機插了幾張 SIM 卡，
這是各家瀏覽器基於隱私刻意不開放的。`navigator.connection` 只能給出 4G/3G 這種粗略的
連線品質估算，不是真實訊號值。

**iOS 同樣做不到**：Apple 從未開放公開 API 讓第三方 App 讀取訊號強度，
`CTTelephonyNetworkInfo` 只能取得電信商名稱與網路制式。使用私有 API 會被 App Store 拒審。

所以真正的自動偵測只有 **Android** 能做到，本專案的 App 為 Android。

## 組成

| 元件 | 位置 | 角色 |
| --- | --- | --- |
| Android App | `android/` | 讀取雙卡訊號 + GPS，自動上傳 |
| 網站 Dashboard | `public/signal-dashboard.html` | 地圖呈現、篩選、即時更新 |
| 資料庫 | Firestore `christykalvin-db` / `signal_reports` | 存放記錄 |

## 一、啟用 Firebase 匿名登入

App 與 Dashboard 都以匿名身分寫入／讀取，這樣安全規則才能要求 `request.auth != null`，
避免資料庫對全世界開放。

Firebase Console → 專案 `voiceout-asia` → Authentication → Sign-in method →
啟用「**匿名（Anonymous）**」。

未啟用時，App 上傳會顯示「請先到 Firebase Console 啟用匿名登入方式」。

## 二、設定 Firestore 安全規則

在 Console → Firestore Database → 選擇資料庫 **`christykalvin-db`** → 規則，
於現有規則中「**新增**」以下區塊（不要刪掉其他既有規則）：

```
match /signal_reports/{reportId} {
  // 已登入者可讀取地圖資料
  allow read: if request.auth != null;

  // 只能新增，不能竄改或刪除既有記錄
  allow create: if request.auth != null
                && request.resource.data.deviceId is string
                && request.resource.data.location.geoPoint is latlng;
  allow update, delete: if false;
}
```

## 三、取得可安裝的 APK

每次推送 `android/` 底下的變更，GitHub Actions 會自動編譯：

1. GitHub → 本 repo → **Actions** → 選 **Build Android APK** 最新一次執行
2. 下方 **Artifacts** → 下載 `signal-scout-debug-apk`
3. 解壓縮得到 `app-debug.apk`，傳到手機安裝（需允許「安裝未知來源應用程式」）

或在本機自行編譯（需安裝 Android Studio）：

```bash
cd android
./gradlew assembleDebug
# 產出：app/build/outputs/apk/debug/app-debug.apk
```

## 四、使用方式

1. 首次開啟 App 會要求「電話」與「精確位置」權限，兩者都必須允許
   （Android 10 起讀取訊號資訊需要位置權限）
2. 主畫面即時顯示主卡／副卡的格數、dBm、網路制式
3. 到訊號差的地點按「**記錄此處訊號**」，會記下當下精準座標 + 兩張卡的訊號
4. 勾選「自動記錄」可每 30 秒自動記一筆（適合邊走邊測，需保持畫面開啟）
5. 訊號弱的地方往往傳不出去，App 會**先存在手機**，等有訊號時自動補傳，
   待上傳筆數會顯示在畫面上，也可按「立即補傳」

## 五、看地圖

網站上線後開啟 `/signal-dashboard.html`，可即時看到所有記錄：

- 標記顏色依訊號強弱：紅（無訊號／極弱）→ 橘（弱）→ 藍（良好）→ 綠（很強）
- 可切換「兩卡取最弱 / 只看主卡 / 只看副卡」、篩選電信商、只看弱訊號點
- 點標記可看該點主副卡完整數據、精確座標與誤差範圍

## 已知限制

- **iOS 無法提供訊號強度**，若之後要做 iOS 版，只能記錄電信商、網路制式、GPS 與實測網速
- 自動記錄需保持 App 在前景；若要背景長時間記錄，需另外實作前景服務（foreground service）
- dBm 的實際意義依制式而異（LTE 為 RSRP、5G 為 SS-RSRP），跨制式比較數值時需注意；
  格數（0–4）由系統依機型校準，跨機型比較較為一致
