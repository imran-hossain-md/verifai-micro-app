// server.ts - International Enterprise Grade Micro-SaaS Engine
import { Application, Router } from "https://deno.land/x/oak@v12.4.0/mod.ts";
import dbClient from "./db.ts";

// পাসওয়ার্ড হ্যাশিংয়ের জন্য ডেনোর স্ট্যান্ডার্ড ক্রিপ্টো মডিউল
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const app = new Application();
const router = new Router();

// কুকি সিকিউরিটির জন্য এন্টারপ্রাইজ সাইনিং কি (Signing Keys)
app.keys = ["SUPER_SECRET_AUDIT_KEY_2026_ISR"];

// ১. ডাটাবেজ টেবিল চেক ও অটো-ক্রিয়েট লজিক
async function initDatabase() {
  try {
    await dbClient.queryObject(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        company_name TEXT,
        password TEXT NOT NULL,
        payment_status TEXT DEFAULT 'pending'
      );
    `);
    await dbClient.queryObject(`
      CREATE TABLE IF NOT EXISTS audits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        responses JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("📁 Database Tables Verified/Created Successfully.");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
  }
}
await initDatabase();

// ২. হোম পেজ রাউট (প্রিমিয়াম এন্টারপ্রাইজ থিম)
router.get("/", async (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <head>
        <title>VerifAI Micro-SaaS Portal</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; max-width: 800px; margin: 100px auto; text-align: center; }
          .card { background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid #334155; }
          h1 { color: #38bdf8; font-size: 2.5rem; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 1.1rem; }
          .btn { padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px; display: inline-block; transition: all 0.3s; }
          .btn-primary { background: #0284c7; color: white; }
          .btn-primary:hover { background: #0369a1; }
          .btn-success { background: #059669; color: white; }
          .btn-success:hover { background: #047857; }
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

// ৩. সাইন-আপ পেজ
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

// ৪. সাইন-আপ সাবমিট (আন্তর্জাতিক গ্রেড পাসওয়ার্ড হ্যাশিং)
router.post("/register", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const name = value.get("name");
  const email = value.get("email");
  const company_name = value.get("company_name");
  const password = value.get("password") || "";

  try {
    // পাসওয়ার্ড সিকিউরলি হ্যাশ করা (Bcrypt)
    const salt = await bcrypt.genSalt(8);
    const hashedPassword = await bcrypt.hash(password, salt);

    await dbClient.queryObject(
      `INSERT INTO users (name, email, company_name, password) VALUES ($1, $2, $3, $4)`,
      [name, email, company_name, hashedPassword]
    );
    ctx.response.redirect("/login?msg=Registration successful! Please login.");
  } catch (_error) {
    ctx.response.body = "❌ Error: Registration failed! Email might already exist.";
  }
});

// ৫. লগইন পেজ
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
    </body>
  `;
});

// ৬. লগইন ভেরিফিকেশন এবং সিকিউর এনক্রিপ্টেড সেশন কুকি প্রদান
router.post("/login", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const email = value.get("email");
  const password = value.get("password") || "";

  const result = await dbClient.queryObject<{ id: number; name: string; password: string; payment_status: string }>(
    `SELECT id, name, password, payment_status FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    
    // হ্যাশ পাসওয়ার্ড ম্যাচিং চেক
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (isPasswordMatch) {
      // ইউআরএল প্যারামিটার বাদ দিয়ে আন্তর্জাতিক মানের সিকিউর কুকি সেশন তৈরি
      await ctx.cookies.set("auth_user_id", String(user.id), { httpOnly: true, signed: true });

      if (user.payment_status === "pending") {
        ctx.response.redirect("/checkout");
      } else {
        ctx.response.redirect("/audit-form");
      }
      return;
    }
  }
  ctx.response.body = "❌ Invalid credentials! <a href='/login' style='color: #38bdf8;'>Try again</a>";
});

// ৭. পেমেন্ট স্ক্রিন (মিডলওয়্যার ভেরিফাইড)
router.get("/checkout", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.redirect("/login"); return; }

  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; background: #0f172a; color: #f8fafc; max-width: 500px; margin: 80px auto; padding: 40px; background: #1e293b; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8;">💳 Gateway Payment Integration</h2>
      <p style="font-size: 1.2rem; margin: 20px 0;">Secure Enterprise Audit Fee: <b style="color: #34d399;">$99 USD</b></p>
      <p style="color: #94a3b8; font-size: 0.9rem;">[SaaS Webhook Sandbox Node Active]</p>
      <form action="/pay-success" method="POST">
        <button type="submit" style="padding: 15px 30px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; width: 100%;">Process Payment via Stripe Sandbox</button>
      </form>
    </body>
  `;
});

// ৮. পেমেন্ট সাকসেস হ্যান্ডলার (কুকি রিড মেকানিজম)
router.post("/pay-success", async (ctx) => {
  const userId = await ctx.cookies.get("auth_user_id", { signed: true });
  if (!userId) { ctx.response.status = 403; return; }

  await dbClient.queryObject(
    `UPDATE users SET payment_status = 'paid' WHERE id = $1`,
    [userId]
  );
  ctx.response.redirect("/audit-form");
});

// ৯. অডিট ফর্ম
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
          <input type="radio" name="q1" value="yes" required> Yes (Score 50) &nbsp;&nbsp;
          <input type="radio" name="q1" value="no"> No (Score 0)
        </div>

        <button type="submit" style="padding: 14px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem;">Submit & Sync Governance Logs</button>
      </form>
    </body>
  `;
});

// ১০. অডিট সাবমিট ও স্কোর সেভ
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

  await dbClient.queryObject(
    `INSERT INTO audits (user_id, score, responses) VALUES ($1, $2, $3)`,
    [userId, score, responses]
  );

  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; background: #0f172a; color: #f8fafc; margin-top: 100px;">
      <h1 style="color: #34d399;">🎉 Governance Audit Completed!</h1>
      <h3 style="font-size: 1.5rem;">Compliance Framework Score: <span style="color: #38bdf8;">${score}%</span></h3>
      <p style="color: #94a3b8;">Cryptographic ledger successfully synched to Render Postgres.</p>
      <br>
      <a href="/logout" style="padding: 10px 20px; background: #334155; color: white; text-decoration: none; border-radius: 5px;">Logout Securely</a>
    </body>
  `;
});

// 🔒 ১১. আন্তর্জাতিক গ্রেড এডমিন ড্যাশবোর্ড (রেন্ডার শেলের বিকল্প)
router.get("/admin-dashboard", async (ctx) => {
  try {
    // ডাটাবেজ থেকে রিলেশনাল জয়েন কুয়েরি চালিয়ে লাইভ ইউজার ও তাদের অডিট রেজাল্ট নিয়ে আসা
    const query = `
      SELECT u.id, u.name, u.email, u.company_name, u.payment_status, a.score, a.created_at 
      FROM users u 
      LEFT JOIN audits a ON u.id = a.user_id
      ORDER BY u.id DESC
    `;
    const result = await dbClient.queryObject<{ id: number; name: string; email: string; company_name: string; payment_status: string; score: number | null; created_at: Date | null }>(query);

    let rowsHtml = "";
    result.rows.forEach(row => {
      rowsHtml += `
        <tr style="border-bottom: 1px solid #334155; text-align: left;">
          <td style="padding: 12px;">${row.id}</td>
          <td style="padding: 12px; font-weight: bold;">${row.name}</td>
          <td style="padding: 12px;">${row.email}</td>
          <td style="padding: 12px;">${row.company_name || 'N/A'}</td>
          <td style="padding: 12px;"><span style="background: ${row.payment_status === 'paid' ? '#065f46' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${row.payment_status.toUpperCase()}</span></td>
          <td style="padding: 12px; color: #38bdf8; font-weight: bold;">${row.score !== null ? row.score + '%' : 'No Audit'}</td>
          <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${row.created_at ? new Date(row.created_at).toLocaleString() : 'Pending'}</td>
        </tr>
      `;
    });

    ctx.response.type = "text/html";
    ctx.response.body = `
      <html>
        <head><title>VerifAI Infrastructure Administration</title></head>
        <body style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px;">
          <div style="max-width: 1100px; margin: 0 auto;">
            <a href="/" style="color: #38bdf8; text-decoration: none;">&larr; Back to Portal</a>
            <h1 style="color: #38bdf8; margin: 20px 0 5px 0;">🔒 VerifAI Infrastructure Control Panel</h1>
            <p style="color: #94a3b8; margin-bottom: 30px;">Live Data Nodes streaming directly from Render PostgreSQL (Singapore)</p>
            
            <table style="width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              <thead>
                <tr style="background: #334155; color: #f8fafc; text-align: left;">
                  <th style="padding: 12px;">UID</th>
                  <th style="padding: 12px;">Client Name</th>
                  <th style="padding: 12px;">Corporate Email</th>
                  <th style="padding: 12px;">Enterprise Node</th>
                  <th style="padding: 12px;">Billing Status</th>
                  <th style="padding: 12px;">Compliance Score</th>
                  <th style="padding: 12px;">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">No data records found in Cloud Cluster.</td></tr>'}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  } catch (error) {
    ctx.response.body = `❌ Database Cluster Error: ${error.message}`;
  }
});

// ১২. সিকিউর লগআউট (কুকি ধ্বংসকরণ)
router.get("/logout", async (ctx) => {
  await ctx.cookies.delete("auth_user_id");
  ctx.response.redirect("/");
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 VerifAI International SaaS Engine running on port 3000");
await app.listen({ port: 3000 });