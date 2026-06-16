import { Application, Router } from "https://deno.land/x/oak@v12.4.0/mod.ts";
import dbClient from "./db.ts";

const app = new Application();
const router = new Router();

// ১. ডাটাবেজ টেবিল চেক ও অটো-ক্রিয়েট লজিক
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
        user_id INTEGER REFERENCES users(id),
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

// ২. হোম পেজ রাউট (সিম্পল এন্টারপ্রাইজ ল্যান্ডিং)
router.get("/", (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <html>
      <head><title>VerifAI Micro-SaaS Portal</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center; background: #f4f6f9; color: #333;">
        <h1 style="color: #1e3a8a;">Welcome to VerifAI Audit Portal</h1>
        <p>Enterprise-grade AI Trust & Compliance Engine</p>
        <hr style="border: 0; height: 1px; background: #ccc; margin: 20px 0;">
        <a href="/register" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px; display: inline-block;">Client Sign Up (Register)</a>
        <a href="/login" style="padding: 10px 20px; background: #059669; color: white; text-decoration: none; border-radius: 5px; margin: 10px; display: inline-block;">Client Login</a>
      </body>
    </html>
  `;
});

// ৩. সাইন-আপ পেজ (HTML Form)
router.get("/register", (ctx) => {
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
      <h2>Client Registration</h2>
      <form action="/register" method="POST" style="display: flex; flex-direction: column; gap: 15px;">
        <input type="text" name="name" placeholder="Full Name" required style="padding: 10px;">
        <input type="email" name="email" placeholder="Email Address" required style="padding: 10px;">
        <input type="text" name="company_name" placeholder="Company Name" required style="padding: 10px;">
        <input type="password" name="password" placeholder="Password" required style="padding: 10px;">
        <button type="submit" style="padding: 12px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Sign Up & Proceed</button>
      </form>
    </body>
  `;
});

// ৪. সাইন-আপ সাবমিট হ্যান্ডলার (API)
router.post("/register", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const name = value.get("name");
  const email = value.get("email");
  const company_name = value.get("company_name");
  const password = value.get("password");

  try {
    // ডাটাবেজে ইউজার ইনসার্ট করা
    await dbClient.queryObject(
      `INSERT INTO users (name, email, company_name, password) VALUES ($1, $2, $3, $4)`,
      [name, email, company_name, password]
    );
    ctx.response.redirect("/login?msg=Registration successful! Please login.");
  } catch (error) {
    ctx.response.body = "❌ Error: Registration failed! Email might already exist.";
  }
});

// ৫. লগইন পেজ (HTML Form)
router.get("/login", (ctx) => {
  const params = ctx.request.url.searchParams;
  const msg = params.get("msg") || "";
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
      <h2>Client Login</h2>
      <p style="color: green;">${msg}</p>
      <form action="/login" method="POST" style="display: flex; flex-direction: column; gap: 15px;">
        <input type="email" name="email" placeholder="Email Address" required style="padding: 10px;">
        <input type="password" name="password" placeholder="Password" required style="padding: 10px;">
        <button type="submit" style="padding: 12px; background: #059669; color: white; border: none; border-radius: 5px; cursor: pointer;">Login</button>
      </form>
    </body>
  `;
});

// ৬. লগইন ভেরিফিকেশন এবং পেমেন্ট গেটওয়ে গেট (Simulated Flow)
router.post("/login", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const email = value.get("email");
  const password = value.get("password");

  const result = await dbClient.queryObject<{ id: number; name: string; payment_status: string }>(
    `SELECT id, name, payment_status FROM users WHERE email = $1 AND password = $2`,
    [email, password]
    );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    // পেমেন্ট পেন্ডিং থাকলে পেমেন্ট স্ক্রিনে যাবে, পেইড হলে সরাসরি অডিট ফর্মে যাবে
    if (user.payment_status === "pending") {
      ctx.response.redirect(`/checkout?user_id=${user.id}`);
    } else {
      ctx.response.redirect(`/audit-form?user_id=${user.id}`);
    }
  } else {
    ctx.response.body = "❌ Invalid email or password! <a href='/login'>Try again</a>";
  }
});

// ৭. পেমেন্ট স্ক্রিন (Stripe সিমুলেশন বাটন)
router.get("/checkout", (ctx) => {
  const userId = ctx.request.url.searchParams.get("user_id");
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; max-width: 500px; margin: 50px auto; padding: 30px; border: 1px solid #ccc; border-radius: 10px;">
      <h2 style="color: #1e3a8a;">💳 Gateway Payment Screen</h2>
      <p>Secure Enterprise Audit Access Fee: <b>$99 USD</b></p>
      <p style="color: #555;">[SaaS Integration Sandbox mode enabled]</p>
      <form action="/pay-success" method="POST">
        <input type="hidden" name="user_id" value="${userId}">
        <button type="submit" style="padding: 15px 30px; background: #6366f1; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold;">Pay via Stripe Sandbox</button>
      </form>
    </body>
  `;
});

// ৮. পемেন্ট সাকসেস হ্যান্ডলার (Webhook/Callback লজিক)
router.post("/pay-success", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const userId = value.get("user_id");

  // ডাটাবেজে ইউজারের পেমেন্ট স্ট্যাটাস 'paid' করে দেওয়া
  await dbClient.queryObject(
    `UPDATE users SET payment_status = 'paid' WHERE id = $1`,
    [userId]
  );

  ctx.response.redirect(`/audit-form?user_id=${userId}`);
});

// ৯. অডিট ফর্ম (পেমেন্ট করার পর ওপেন হবে)
router.get("/audit-form", (ctx) => {
  const userId = ctx.request.url.searchParams.get("user_id");
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; max-width: 600px; margin: 30px auto; padding: 20px; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      <h2 style="color: #1e3a8a;">📋 VerifAI Enterprise Audit Checklist</h2>
      <p>Please complete the parameters for AI compliance scoring.</p>
      <form action="/submit-audit" method="POST" style="display: flex; flex-direction: column; gap: 20px;">
        <input type="hidden" name="user_id" value="${userId}">
        
        <div>
          <label><b>1. Do you document model bias mitigation steps? (EU AI Act Compliant)</b></label><br>
          <input type="radio" name="q1" value="yes" required> Yes (Score 50) 
          <input type="radio" name="q1" value="no"> No (Score 0)
        </div>

        <div>
          <label><b>2. Is there automated human-in-the-loop oversight?</b></label><br>
          <input type="radio" name="q2" value="yes" required> Yes (Score 50) 
          <input type="radio" name="q2" value="no"> No (Score 0)
        </div>

        <button type="submit" style="padding: 12px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Submit & Generate PDF Report</button>
      </form>
    </body>
  `;
});

// ১০. অডিট সাবমিট ও স্কোর সেভ লজিক
router.post("/submit-audit", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const value = await body.value;
  const userId = value.get("user_id");
  const q1 = value.get("q1");
  const q2 = value.get("q2");

  // স্কোর ক্যালকুলেশন
  let score = 0;
  if (q1 === "yes") score += 50;
  if (q2 === "yes") score += 50;

  const responses = JSON.stringify({ q1, q2 });

  // ডাটাবেজে অডিট রিপোর্ট সেভ করা
  await dbClient.queryObject(
    `INSERT INTO audits (user_id, score, responses) VALUES ($1, $2, $3)`,
    [userId, score, responses]
  );

  // পিডিএফ জেনারেশন স্ক্রিন বা কনফার্মেশন
  ctx.response.type = "text/html";
  ctx.response.body = `
    <body style="font-family: Arial; text-align: center; margin-top: 100px;">
      <h1 style="color: green;">🎉 Audit Completed Successfully!</h1>
      <h3>Your Compliance Score: <span style="color: blue;">${score}%</span></h3>
      <p>Enterprise Audit Log saved securely in Render PostgreSQL Database.</p>
      <br>
      <a href="/" style="padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px;">Logout Securely</a>
    </body>
  `;
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 VerifAI SaaS Engine running on http://localhost:3000");
await app.listen({ port: 3000 });