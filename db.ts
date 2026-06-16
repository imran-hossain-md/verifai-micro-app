// db.ts - এন্টারপ্রাইজ ডাটাবেজ কানেকশন ম্যানেজার
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// ক্লাউডের এনভায়রনメント ভ্যারিয়েবল থেকে ডাটাবেজ ইউআরএল রিড করা
const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL এনভায়রনমেন্ট ভ্যারিয়েবল সেট করা নেই!");
  Deno.exit(1);
}

// ডাটাবেজ ক্লায়েন্ট ইনিশিয়ালাইজ করা
const client = new Client(databaseUrl);

try {
  await client.connect();
  console.log("🚀 Render PostgreSQL ডাটাবেজের সাথে সফলভাবে কানেক্টেড!");
} catch (error) {
  console.error("❌ ডাটাবেজ কানেকশনে এরর এসেছে:", error);
}

export default client;