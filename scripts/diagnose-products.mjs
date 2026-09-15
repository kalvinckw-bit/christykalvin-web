// 診斷用：模擬前台訪客（未登入）用同一組 query 讀 products collection，
// 確認「商品全部不見了」是資料問題（真的 0 筆 published）還是規則權限問題（會噴 permission-denied）。
// 只能在有完整外部網路的 CI runner 執行，開發用的雲端 sandbox 連不到 firestore。
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBbTKwYIs3pdPKffbk4-GiQzK7P8lQpUBQ",
  authDomain: "christykalvin.firebaseapp.com",
  projectId: "christykalvin",
  storageBucket: "christykalvin.firebasestorage.app",
  messagingSenderId: "488782388942",
  appId: "1:488782388942:web:0501238a5c77fe9feeba9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== 模擬前台查詢：query(collection(db,'products'), where('status','==','published')) ===");
  try {
    const q = query(collection(db, "products"), where("status", "==", "published"));
    const snap = await getDocs(q);
    console.log(`結果：${snap.size} 筆`);
    snap.docs.slice(0, 10).forEach(d => {
      const data = d.data();
      console.log(`- ${d.id} | status=${data.status} | title_zh=${data.title_zh || ""} | created_at=${data.created_at}`);
    });
  } catch (err) {
    console.error("QUERY ERROR code=", err.code, "message=", err.message);
  }

  console.log("\n=== 額外檢查：不加 status 篩選直接查整個 collection（預期應該被規則擋掉，用來確認規則真的有在擋） ===");
  try {
    const snapAll = await getDocs(collection(db, "products"));
    console.log(`未過濾查詢意外成功，回傳 ${snapAll.size} 筆（不應該發生，代表規則可能有問題）`);
  } catch (err) {
    console.log("未過濾查詢如預期被擋下：", err.code, err.message);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error("FATAL", err); process.exit(1); });
