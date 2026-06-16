// server.ts - VerifAI Core JSON API Engine
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import dbClient from "./db.ts"; // আপনার মডিউলার ডাটাবেজ ক্লায়েন্ট এক্সপোর্ট

const app = new Application();
const router = new Router();

// কুকি সিকিউরিটির জন্য সাইনিং কি
app.keys = ["SUPER_SECRET_AUDIT_KEY_2026_ISR"];

// 🛠️ VerifAI ল্যাবস ডাটাবেজ স্কিমা অটো-মাইগ্রেশন ও সিঙ্ক ম্যানেজার
async function initDatabase() {
  try {
    // ১. ইউজার টেবিল এবং অ্যাডমিন রোল ট্র্যাকিং
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        company_name VARCHAR(150),
        payment_status VARCHAR(50) DEFAULT 'pending',
        is_admin BOOLEAN DEFAULT FALSE
      );
    `);

    // পাসওয়ার্ড রিসেটের এন্টারপ্রাইজ কলাম ভেরিফিকেশন
    await dbClient.queryArray(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);`);
    await dbClient.queryArray(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;`);
    await dbClient.queryArray(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;`);

    // ২. অডিট রেজাল্ট ও র-রেসপন্স স্টোরেজ টেবিল
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS audits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        responses JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ৩. ISO 27001 (A-12.4.1) সিকিউরিটি লগ টেবিল
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("📁 VerifAI Systems Node: Database Architecture Synced.");
  } catch (error) {
    console.error("❌ Schema Sync Fail:", error);
  }
}
await initDatabase();

// 🛡️ ISO সিকিউরিটি ইভেন্ট লগিং ইউটিলস
async function logSecurityEvent(eventType: string, description: string) {
  try {
    await dbClient.queryArray(
      "INSERT INTO system_logs (event_type, description) VALUES ($1, $2)",
      [eventType, description]
    );
  } catch (err) {
    console.error("Log Engine Failed:", err);
  }
}

// -------------------------------------------------------------------------
// 🔐 সেশন ও অথেনটিকেশন মিডলওয়্যার (Security Gate)
// -------------------------------------------------------------------------
async function getAuthUser(ctx: any) {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) return null;
  
  const userRes = await dbClient.queryObject<any>(
    "SELECT id, name, email, company_name, payment_status, is_admin FROM users WHERE id = $1", 
    [userId]
  );
  return userRes.rows[0] || null;
}

// -------------------------------------------------------------------------
// 📡 JSON API ROUTING (Clean Architecture)
// -------------------------------------------------------------------------

// ১. গ্লোবাল স্টেট চেক এপিআই (ফ্রন্টএন্ড লোড হওয়ার সাথে সাথে এটি কল করবে)
router.get("/api/session", async (ctx) => {
  const user = await getAuthUser(ctx);
  ctx.response.body = { authenticated: !!user, user: user || null };
});

// ২. ক্লায়েন্ট রেজিস্ট্রেশন (POST)
router.post("/api/auth/register", async (ctx) => {
  try {
    const body = ctx.request.body({ type: "json" });
    const { name, email, company_name, password } = await body.value;

    if (!name || !email || !password) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "Missing required compliance fields." };
      return;
    }

    const salt = await bcrypt.genSalt(8);
    const hashedPassword = await bcrypt.hash(password, salt);

    // সিস্টেমের ১ম ইউজারকে অটো-অ্যাডমিন করার সেফগার্ড মেকানিজম
    const countCheck = await dbClient.queryArray("SELECT COUNT(*) FROM users");
    const isFirstUser = parseInt(countCheck.rows[0][0] as string) === 0;

    await dbClient.queryArray(
      `INSERT INTO users (name, email, company_name, password, is_admin) VALUES ($1, $2, $3, $4, $5)`,
      [name, email, company_name || "N/A", hashedPassword, isFirstUser]
    );

    ctx.response.status = 201;
    ctx.response.body = { success: true, message: "Registration successful." };
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Email already exists or database constraint violation." };
  }
});

// ৩. ক্লায়েন্ট সিকিউর লগইন (POST)
router.post("/api/auth/login", async (ctx) => {
  const body = ctx.request.body({ type: "json" });
  const { email, password } = await body.value;

  const result = await dbClient.queryObject<any>(
    `SELECT id, password, payment_status, is_admin FROM users WHERE email = $1`, [email]
  );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (isPasswordMatch) {
      await ctx.cookies.set("auth_user_id", String(user.id), { 
        httpOnly: true, 
        signed: true,
        sameSite: "lax"
      });

      ctx.response.body = { 
        success: true, 
        payment_status: user.payment_status, 
        is_admin: user.is_admin 
      };
      return;
    }
  }

  ctx.response.status = 401;
  ctx.response.body = { success: false, error: "Invalid cryptographic credentials." };
});

// ৪. পেমেন্ট গেটওয়ে সিমুলেশন (POST)
router.post("/api/payment/checkout", async (ctx) => {
  const user = await getAuthUser(ctx);
  if (!user) { ctx.response.status = 401; return; }

  await dbClient.queryArray(`UPDATE users SET payment_status = 'paid' WHERE id = $1`, [user.id]);
  await logSecurityEvent("BILLING_SUCCESS", `User UID ${user.id} successfully completed Sandbox settlement.`);
  
  ctx.response.body = { success: true, message: "Payment processed successfully." };
});

// ৫. ৫-প্যারামিটার অডিট ইঞ্জিন সাবমিশন (POST)
router.post("/api/audit/submit", async (ctx) => {
  const user = await getAuthUser(ctx);
  if (!user) { ctx.response.status = 401; return; }
  if (user.payment_status !== "paid") {
    ctx.response.status = 402;
    ctx.response.body = { success: false, error: "Payment required to unlock GRC engine." };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  const responses = await body.value; // { q1: "yes", q2: "no", q3: "yes", q4: "yes", q5: "no" }

  // 📈 ৫টি কোর স্ট্র্যাটেজিক অডিট প্রশ্ন ও ২০% ওয়েটেজ লজিক
  let score = 0;
  const questions = ["q1", "q2", "q3", "q4", "q5"];
  questions.forEach((q) => {
    if (responses[q] === "yes") score += 20;
  });

  await dbClient.queryArray(
    `INSERT INTO audits (user_id, score, responses) VALUES ($1, $2, $3)`, 
    [user.id, score, JSON.stringify(responses)]
  );

  ctx.response.body = { success: true, calculated_score: score };
});

// ৬. ফরগট পাসওয়ার্ড টোকেন জেনারেটর (POST)
router.post("/api/auth/forgot-password", async (ctx) => {
  const body = ctx.request.body({ type: "json" });
  const { email } = await body.value;

  const userRes = await dbClient.queryObject<any>("SELECT id FROM users WHERE email = $1", [email]);

  if (userRes.rows.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Registry entry not found." };
    return;
  }

  const user = userRes.rows[0];
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 15 * 60 * 1000); 

  await dbClient.queryArray(
    "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
    [token, expires, user.id]
  );

  await logSecurityEvent("PASSWORD_RESET_REQUEST", `Secure token dispatched for UID ${user.id}`);

  // ফ্রন্টএন্ড যাতে ইউজারকে লিংকটা শো করতে পারে
  ctx.response.body = { 
    success: true, 
    reset_token: token,
    expires_in_minutes: 15 
  };
});

// ৭. পাসওয়ার্ড রিসেট এক্সিকিউশন (POST)
router.post("/api/auth/reset-password", async (ctx) => {
  const body = ctx.request.body({ type: "json" });
  const { token, new_password } = await body.value;

  const userRes = await dbClient.queryObject<any>(
    "SELECT id, reset_token_expires FROM users WHERE reset_token = $1", [token]
  );

  if (userRes.rows.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Invalid or corrupt security token." };
    return;
  }

  const user = userRes.rows[0];
  if (new Date() > new Date(user.reset_token_expires)) {
    ctx.response.status = 400;
    ctx.response.body = { success: false, error: "Token expired. Request a new validation lease." };
    return;
  }

  const hashedPassword = await bcrypt.hash(new_password);
  await dbClient.queryArray(
    "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
    [hashedPassword, user.id]
  );

  await logSecurityEvent("PASSWORD_CHANGE_SUCCESS", `Cryptographic hash rotation completed for UID ${user.id}`);
  ctx.response.body = { success: true, message: "Password updated via fallback token." };
});

// 📊 ৮. ইনফ্রাস্ট্রাকচার ড্যাশবোর্ড ডেটা এপিআই (🔒 সিকিউরিটি লকিং গেটওয়ে)
router.get("/api/admin/dashboard-telemetry", async (ctx) => {
  const user = await getAuthUser(ctx);
  
  // ⛔ স্ট্রাকচারাল গেটকীপার: ইউজার লগড-ইন না থাকলে বা admin ফ্ল্যাগ মিথ্যা হলে রিফিউজ
  if (!user || user.is_admin !== true) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: "Access Denied: Infrastructure Clearance Required." };
    return;
  }

  try {
    const mainResult = await dbClient.queryObject<any>(`
      SELECT DISTINCT ON (u.id) u.id, u.name, u.email, u.company_name, u.payment_status, a.score, a.created_at 
      FROM users u LEFT JOIN audits a ON u.id = a.user_id ORDER BY u.id DESC, a.created_at DESC
    `);

    const historyResult = await dbClient.queryObject<any>(`
      SELECT a.id as audit_id, u.name, u.company_name, a.score, a.created_at FROM audits a
      JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC
    `);

    const logResult = await dbClient.queryObject<any>(
      "SELECT id, event_type, description, timestamp FROM system_logs ORDER BY timestamp DESC LIMIT 10"
    );

    ctx.response.body = {
      success: true,
      metrics: {
        active_registry: mainResult.rows,
        historical_trails: historyResult.rows,
        telemetry_logs: logResult.rows
      }
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: error.message };
  }
});

// 🔒 ৯. সিকিউর লগআউট (POST)
router.post("/api/auth/logout", async (ctx) => {
  await ctx.cookies.delete("auth_user_id");
  ctx.response.body = { success: true, message: "Session destroyed safely." };
});

// 📁 ১০. স্ট্যাটিক ফাইল হ্যান্ডলিং (পাবলিক ফোল্ডারের index.html লোড করার মেকানিজম)
router.get("/(.*)", async (ctx) => {
  try {
    await ctx.send({
      root: `${Deno.cwd()}/public`,
      index: "index.html",
    });
  } catch {
    // ফাইল না পাইলে ইনডেক্সে ফলব্যাক (Single Page Application UX)
    await ctx.send({
      root: `${Deno.cwd()}/public`,
      index: "index.html",
    });
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 VerifAI Labs GRC API Engine Live on port 3000");
await app.listen({ port: 3000 });