import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// 🌍 ক্লাউড ডাটাবেজ কানেকশন কনফিগারেশন (Render PostgreSQL Singapore)
const DATABASE_URL = Deno.env.get("DATABASE_URL") || "your_postgresql_connection_string_here";
const dbClient = new Client(DATABASE_URL);
await dbClient.connect();

const app = new Application();
const router = new Router();

// কুকি সিকিউরিটির জন্য এন্টারপ্রাইজ সাইনিং কি (Signing Keys)
app.keys = ["SUPER_SECRET_AUDIT_KEY_2026_ISR"];

// 🛠️ ISO কমপ্লায়েন্স ডাটাবেজ টেবিল ইনিশিয়ালাইজেশন ও অটো-মাইগ্রেশন
async function initDatabase() {
  try {
    // ১. ইউজার টেবিল ভেরিফিকেশন
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        company_name VARCHAR(150),
        payment_status VARCHAR(50) DEFAULT 'pending'
      );
    `);

    // 🔥 [ISO মাইগ্রেশন লজিক] পাসওয়ার্ড রিসেটের জন্য কলাম দুটি অটো-ক্রিয়েট করার মেকানিজম
    await dbClient.queryArray(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
    `);
    await dbClient.queryArray(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
    `);

    // ২. অডিট টেবিল ভেরিফিকেশন
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS audits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        responses JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ৩. ISO 27001 (A-12.4.1) সিকিউরিটি লগ টেবিল ভেরিফিকেশন
    await dbClient.queryArray(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("📁 ISO Database Schema Verified & Synced Successfully.");
  } catch (error) {
    console.error("❌ Error synchronizing database schema:", error);
  }
}
await initDatabase();

// 🛡️ হেল্পার ফাংশন: ISO সিকিউরিটি ইভেন্ট লগিং
async function logSecurityEvent(eventType: string, description: string) {
  await dbClient.queryArray(
    "INSERT INTO system_logs (event_type, description) VALUES ($1, $2)",
    [eventType, description]
  );
}

// -------------------------------------------------------------------------
// 🏠 ১. হোম ল্যান্ডিং পেজ রাউট
// -------------------------------------------------------------------------
router.get("/", (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <head>
        <title>VerifAI Micro-SaaS Portal</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; max-width: 800px; margin: 100px auto; text-align: center; }
          .card { background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid #334155; }
          h1 { color: #38bdf8; font-size: 2.5rem; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 1.1rem; }
          .btn { padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px; display: inline-block; transition: all 0.3s; }
          .btn-primary { background: #0284c7; color: white; }
          .btn-success { background: #059669; color: white; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>VerifAI Audit Portal</h1>
          <p>Enterprise-grade AI Trust, Risk & Governance Compliance Engine</p>
          <hr style="border: 0; height: 1px; background: #334155; margin: 30px 0;">
          <a href="/register" class="btn btn-primary">Client Sign Up</a>
          <a href="/login" class="btn btn-success">Client Login</a>
          <a href="/admin-dashboard" style="color: #64748b; display: block; margin-top: 20px; text-decoration: none; font-size: 0.9rem;">🔒 Infrastructure Admin Access</a>
        </div>
      </body>
    </html>
  `;
});

// -------------------------------------------------------------------------
// 📝 ২. ক্লায়েন্ট রেজিস্ট্রেশন (GET & POST)
// -------------------------------------------------------------------------
router.get("/register", (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; background: #0f172a; color: #f8fafc; max-width: 400px; margin: 80px auto; padding: 30px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8; margin-bottom: 20px;">Client Registration</h2>
      <form action="/register" method="POST" style="display: flex; flex-direction: column; gap: 15px;">
        <input type="text" name="name" placeholder="Full Name" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <input type="email" name="email" placeholder="Email Address" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <input type="text" name="company_name" placeholder="Company Name" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <input type="password" name="password" placeholder="Password" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <button type="submit" style="padding: 12px; background: #0284c7; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Sign Up & Proceed</button>
      </form>
    </body>
  `;
});

router.post("/register", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const name = value.get("name");
  const email = value.get("email");
  const company_name = value.get("company_name");
  const password = value.get("password") || "";

  try {
    const salt = await bcrypt.genSalt(8);
    const hashedPassword = await bcrypt.hash(password, salt);

    await dbClient.queryArray(
      `INSERT INTO users (name, email, company_name, password) VALUES ($1, $2, $3, $4)`,
      [name, email, company_name, hashedPassword]
    );
    ctx.response.redirect("/login?msg=Registration successful! Please login.");
  } catch (_error) {
    ctx.response.body = "❌ Error: Registration failed! Email might already exist. <a href='/register'>Try again</a>";
  }
});

// -------------------------------------------------------------------------
// 🔑 ৩. ক্লায়েন্ট সিকিউর লগইন (GET & POST)
// -------------------------------------------------------------------------
router.get("/login", (ctx) => {
  const params = ctx.request.url.searchParams;
  const msg = params.get("msg") || "";
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; background: #0f172a; color: #f8fafc; max-width: 400px; margin: 80px auto; padding: 30px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
      <h2 style="color: #059669; margin-bottom: 20px;">Client Login</h2>
      <p style="color: #34d399;">${msg}</p>
      <form action="/login" method="POST" style="display: flex; flex-direction: column; gap: 15px;">
        <input type="email" name="email" placeholder="Email Address" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <input type="password" name="password" placeholder="Password" required style="padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 4px;">
        <button type="submit" style="padding: 12px; background: #059669; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Secure Login</button>
      </form>
      <p style="margin-top: 20px; text-align: center;"><a href="/forgot-password" style="color: #38bdf8; text-decoration: none; font-size: 0.9rem;">Forgot Password?</a></p>
    </body>
  `;
});

router.post("/login", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const email = value.get("email");
  const password = value.get("password") || "";

  const result = await dbClient.queryObject<{ id: number; password: string; payment_status: string }>(
    `SELECT id, password, payment_status FROM users WHERE email = $1`, [email]
  );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (isPasswordMatch) {
      await ctx.cookies.set("auth_user_id", String(user.id), { httpOnly: true, signed: true });
      if (user.payment_status === "pending") {
        ctx.response.redirect("/checkout");
      } else {
        ctx.response.redirect("/audit-form");
      }
      return;
    }
  }
  ctx.response.body = "❌ Invalid credentials! <a href='/login'>Try again</a>";
});

// -------------------------------------------------------------------------
// 💳 ৪. পেমেন্ট গেটওয়ে সিমুলেশন (GET & POST)
// -------------------------------------------------------------------------
router.get("/checkout", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.redirect("/login"); return; }

  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; background: #0f172a; color: #f8fafc; max-width: 500px; margin: 80px auto; padding: 40px; background: #1e293b; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8;">💳 Gateway Payment Integration</h2>
      <p style="font-size: 1.2rem; margin: 20px 0;">Secure Enterprise Audit Fee: <b style="color: #34d399;">$99 USD</b></p>
      <form action="/pay-success" method="POST">
        <button type="submit" style="padding: 15px 30px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; width: 100%;">Process Payment via Stripe Sandbox</button>
      </form>
    </body>
  `;
});

router.post("/pay-success", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.status = 403; return; }

  await dbClient.queryArray(`UPDATE users SET payment_status = 'paid' WHERE id = $1`, [userId]);
  ctx.response.redirect("/audit-form");
});

// -------------------------------------------------------------------------
// 📋 ৫. অডিট ফর্ম এবং সাবমিশন হ্যান্ডলিং (GET & POST)
// -------------------------------------------------------------------------
router.get("/audit-form", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.redirect("/login"); return; }

  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; background: #0f172a; color: #f8fafc; max-width: 650px; margin: 40px auto; padding: 30px; background: #1e293b; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8; margin-bottom: 5px;">📋 VerifAI Enterprise Audit Checklist</h2>
      <p style="color: #94a3b8; margin-bottom: 25px;">ISO 42001 & EU AI Act Algorithmic Compliance Parameters</p>
      <form action="/submit-audit" method="POST" style="display: flex; flex-direction: column; gap: 25px;">
        <div style="background: #0f172a; padding: 15px; border-radius: 6px;">
          <label style="display:block; margin-bottom: 10px;"><b>1. Do you document model bias mitigation steps?</b></label>
          <input type="radio" name="q1" value="yes" required> Yes (Score 50) &nbsp;&nbsp;
          <input type="radio" name="q1" value="no"> No (Score 0)
        </div>
        <div style="background: #0f172a; padding: 15px; border-radius: 6px;">
          <label style="display:block; margin-bottom: 10px;"><b>2. Is there automated human-in-the-loop oversight?</b></label>
          <input type="radio" name="q2" value="yes" required> Yes (Score 50) &nbsp;&nbsp;
          <input type="radio" name="q2" value="no"> No (Score 0)
        </div>
        <button type="submit" style="padding: 14px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem;">Submit & Sync Governance Logs</button>
      </form>
    </body>
  `;
});

router.post("/submit-audit", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.status = 403; return; }

  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const q1 = value.get("q1");
  const q2 = value.get("q2");

  let score = 0;
  if (q1 === "yes") score += 50;
  if (q2 === "yes") score += 50;

  const responses = JSON.stringify({ q1, q2 });
  await dbClient.queryArray(`INSERT INTO audits (user_id, score, responses) VALUES ($1, $2, $3)`, [userId, score, responses]);

  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; background: #0f172a; color: #f8fafc; margin-top: 100px;">
      <h1 style="color: #34d399;">🎉 Governance Audit Completed!</h1>
      <h3>Compliance Framework Score: <span style="color: #38bdf8;">${score}%</span></h3>
      <a href="/logout" style="padding: 10px 20px; background: #334155; color: white; text-decoration: none; border-radius: 5px; display:inline-block; margin-top:20px;">Logout Securely</a>
    </body>
  `;
});

// -------------------------------------------------------------------------
// 🔒 ৬. পাসওয়ার্ড ভুলে গেলে টোকেন জেনারেশন রাউট (Forgot Password - GET & POST)
// -------------------------------------------------------------------------
router.get("/forgot-password", (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <h2 style="color: #38bdf8;">🔒 Password Recovery</h2>
          <p style="color: #94a3b8; font-size: 0.9rem;">Enter your corporate email to generate an ISO-compliant secure reset token.</p>
          <form action="/forgot-password" method="POST" style="margin-top: 20px;">
            <input type="email" name="email" placeholder="Corporate Email" required style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: #fff;"><br>
            <button type="submit" style="width: 100%; padding: 10px; background: #38bdf8; color: #0f172a; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Generate Secure Link</button>
          </form>
          <p style="margin-top: 15px;"><a href="/login" style="color: #64748b; text-decoration: none; font-size: 0.85rem;">Back to Login</a></p>
        </div>
      </body>
    </html>
  `;
});

router.post("/forgot-password", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const email = value.get("email");

  const userRes = await dbClient.queryObject<{ id: number; name: string }>(
    "SELECT id, name FROM users WHERE email = $1", [email]
  );

  if (userRes.rows.length === 0) {
    ctx.response.body = "❌ Email address not found in our secure registry. <a href='/forgot-password'>Try again</a>";
    return;
  }

  const user = userRes.rows[0];
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 15 * 60 * 1000); 

  await dbClient.queryArray(
    "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
    [token, expires, user.id]
  );

  await logSecurityEvent("PASSWORD_RESET_REQUEST", `Secure reset token generated for UID ${user.id}`);

  const resetLink = `${ctx.request.url.origin}/reset-password?token=${token}`;

  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border-top: 4px solid #34d399;">
          <h3 style="color: #34d399;">🔑 Secure Reset Link Generated Successfully</h3>
          <p style="color: #94a3b8; font-size: 0.9rem; text-align: left;">ISO Compliance Note: This link is unique, cryptographically secure, and will strictly expire in 15 minutes.</p>
          <div style="background: #0f172a; padding: 15px; border-radius: 4px; word-break: break-all; margin: 20px 0; border: 1px solid #334155;">
            <a href="${resetLink}" style="color: #38bdf8; font-weight: bold; font-family: monospace;">Click Here to Reset Password</a>
          </div>
        </div>
      </body>
    </html>
  `;
});

// -------------------------------------------------------------------------
// 🔒 ৭. পাসওয়ার্ড রিসেট সাবমিশন অ্যাকশন (Reset Password - GET & POST)
// -------------------------------------------------------------------------
router.get("/reset-password", async (ctx) => {
  const token = ctx.request.url.searchParams.get("token");
  if (!token) { ctx.response.body = "❌ Invalid Request: Secure token missing."; return; }

  const userRes = await dbClient.queryObject<{ id: number; reset_token_expires: Date }>(
    "SELECT id, reset_token_expires FROM users WHERE reset_token = $1", [token]
  );

  if (userRes.rows.length === 0) { ctx.response.body = "❌ Invalid or expired token link."; return; }

  const user = userRes.rows[0];
  if (new Date() > new Date(user.reset_token_expires)) {
    ctx.response.body = "❌ Access Denied: Secure token has expired (15-min limit reached).";
    return;
  }

  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <h2 style="color: #38bdf8;">🔄 Create New Password</h2>
          <form action="/reset-password" method="POST" style="margin-top: 20px;">
            <input type="hidden" name="token" value="${token}">
            <input type="password" name="password" placeholder="Enter New Secure Password" required style="width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: #fff;"><br>
            <button type="submit" style="width: 100%; padding: 10px; background: #34d399; color: #0f172a; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Update Secure Password</button>
          </form>
        </div>
      </body>
    </html>
  `;
});

router.post("/reset-password", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const token = value.get("token");
  const newPassword = value.get("password") || "";

  const userRes = await dbClient.queryObject<{ id: number; reset_token_expires: Date }>(
    "SELECT id, reset_token_expires FROM users WHERE reset_token = $1", [token]
  );

  if (userRes.rows.length === 0) { ctx.response.body = "❌ Token verification failed."; return; }

  const user = userRes.rows[0];
  if (new Date() > new Date(user.reset_token_expires)) { ctx.response.body = "❌ Token expired."; return; }

  const hashedPassword = await bcrypt.hash(newPassword);

  await dbClient.queryArray(
    "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
    [hashedPassword, user.id]
  );

  await logSecurityEvent("PASSWORD_CHANGE_SUCCESS", `Password updated via secure reset token for UID ${user.id}`);

  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <h3 style="color: #34d399;">🎉 Password Updated Successfully</h3>
          <p style="color: #94a3b8; font-size: 0.9rem;">Your cryptographic hash has been securely committed to Cloud Cluster.</p>
          <a href="/login" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #38bdf8; color: #0f172a; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
        </div>
      </body>
    </html>
  `;
});

// -------------------------------------------------------------------------
// 📊 ৮. প্রফেশনাল কন্ট্রোল প্যানেল ও ইনফ্রাস্ট্রাকচার ড্যাশবোর্ড (With ISO Logs)
// -------------------------------------------------------------------------
router.get("/admin-dashboard", async (ctx) => {
  try {
    const mainQuery = `
      SELECT DISTINCT ON (u.id) u.id, u.name, u.email, u.company_name, u.payment_status, a.score, a.created_at 
      FROM users u LEFT JOIN audits a ON u.id = a.user_id ORDER BY u.id DESC, a.created_at DESC
    `;
    const mainResult = await dbClient.queryObject<any>(mainQuery);

    const historyQuery = `
      SELECT a.id as audit_id, u.name, u.company_name, a.score, a.created_at FROM audits a
      JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC
    `;
    const historyResult = await dbClient.queryObject<any>(historyQuery);

    const logQuery = "SELECT id, event_type, description, timestamp FROM system_logs ORDER BY timestamp DESC LIMIT 5";
    const logResult = await dbClient.queryObject<any>(logQuery);

    let mainRowsHtml = "";
    mainResult.rows.forEach((row: any) => {
      mainRowsHtml += `<tr style="border-bottom: 1px solid #334155;"><td style="padding:12px;">${row.id}</td><td style="padding:12px; font-weight:bold; color:#fff;">${row.name}</td><td style="padding:12px; color:#94a3b8;">${row.email}</td><td style="padding:12px; color:#94a3b8;">${row.company_name || 'N/A'}</td><td style="padding:12px;"><span style="background:${row.payment_status==='paid'?'#065f46':'#991b1b'}; color:white; padding:4px 8px; border-radius:4px;">${row.payment_status.toUpperCase()}</span></td><td style="padding:12px; color:#38bdf8; font-weight:bold;">${row.score !== null ? row.score + '%' : 'No Audit'}</td><td style="padding:12px; color:#64748b;">${row.created_at ? new Date(row.created_at).toLocaleString() : 'Pending'}</td></tr>`;
    });

    let historyRowsHtml = "";
    historyResult.rows.forEach((row: any) => {
      historyRowsHtml += `<tr style="border-bottom: 1px solid #1e293b;"><td style="padding:10px; color:#64748b;">#AUD-${row.audit_id}</td><td style="padding:10px;">${row.name} (${row.company_name})</td><td style="padding:10px; color:#34d399; font-weight:bold;">${row.score}%</td><td style="padding:10px; color:#64748b;">${new Date(row.created_at).toLocaleString()}</td></tr>`;
    });

    let logRowsHtml = "";
    logResult.rows.forEach((row: any) => {
      logRowsHtml += `<tr style="border-bottom: 1px solid #1e293b; font-family: monospace; font-size: 0.85rem;"><td style="padding:8px; color:#f87171;">${row.event_type}</td><td style="padding:8px; color:#cbd5e1;">${row.description}</td><td style="padding:8px; color:#64748b;">${new Date(row.timestamp).toLocaleString()}</td></tr>`;
    });

    ctx.response.type = "text/html";
    ctx.response.body = `
      <html>
        <head><title>VerifAI Infrastructure Administration</title></head>
        <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0;">
          <div style="max-width: 1200px; margin: 0 auto;">
            <a href="/" style="color: #38bdf8; text-decoration: none; font-weight: bold;">&larr; Back to Portal</a>
            <h1 style="color: #38bdf8; margin: 20px 0 5px 0;">🔒 VerifAI Infrastructure Control Panel (ISO 27001 Certified Architecture)</h1>
            <p style="color: #94a3b8; margin-bottom: 30px;">Live Compliance Clusters Data Node &bull; Singapore</p>
            
            <h2 style="color: #f1f5f9; font-size: 1.2rem; margin-top: 30px; margin-bottom: 10px;">🛡️ ISO 27001 Live Security Audit Logs (A-12.4.1)</h2>
            <table style="width: 100%; border-collapse: collapse; background: #020617; border-radius: 6px; margin-bottom: 40px; border: 1px solid #ef4444;">
              <thead><tr style="background: #7f1d1d; color: #fca5a5; text-align: left;"><th style="padding: 10px;">Event Token</th><th style="padding: 10px;">Telemetry Audit Trail Log</th><th style="padding: 10px;">Timestamp</th></tr></thead>
              <tbody>${logRowsHtml || '<tr><td colspan="3" style="padding:15px; text-align:center; color:#64748b;">No security incidents/events logged yet.</td></tr>'}</tbody>
            </table>

            <h2 style="color: #f1f5f9; font-size: 1.2rem; margin-bottom: 10px;">📊 Active Client Registry</h2>
            <table style="width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; margin-bottom: 40px;">
              <thead><tr style="background: #334155; color: #cbd5e1; text-align: left;"><th style="padding: 12px;">UID</th><th style="padding: 12px;">Client Name</th><th style="padding: 12px;">Corporate Email</th><th style="padding: 12px;">Enterprise Node</th><th style="padding: 12px;">Billing Status</th><th style="padding: 12px;">Latest Score</th><th style="padding: 12px;">Last Active</th></tr></thead>
              <tbody>${mainRowsHtml}</tbody>
            </table>

            <h2 style="color: #f1f5f9; font-size: 1.2rem; margin-bottom: 10px;">📜 Historical Audit Trails</h2>
            <table style="width: 100%; border-collapse: collapse; background: #111827; border-radius: 8px;">
              <thead><tr style="background: #1f2937; color: #9ca3af; text-align: left;"><th style="padding: 10px;">Audit ID</th><th style="padding: 10px;">Enterprise Entity</th><th style="padding: 10px;">Archived Score</th><th style="padding: 10px;">Logged Timestamp</th></tr></thead>
              <tbody>${historyRowsHtml}</tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  } catch (error) {
    ctx.response.body = `❌ Database Cluster Error: ${error.message}`;
  }
});

// 🔒 ৯. সিকিউর লগআউট (কুকি ধ্বংসকরণ)
router.get("/logout", async (ctx) => {
  await ctx.cookies.delete("auth_user_id");
  ctx.response.redirect("/");
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 VerifAI ISO Core Engine Live on port 3000");
await app.listen({ port: 3000 });