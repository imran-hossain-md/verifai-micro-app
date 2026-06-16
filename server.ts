// server.ts এর ওপরের অংশ নিশ্চিত করুন:
import { pool, initializeDatabase, logAuditAction } from "./db.ts";
import { create, verify, decode } from "https://deno.land/x/djwt@v2.8/mod.ts";

// বাকি সব এপিআই লজিক ও ডেনো সার্ভার আগের মতোই থাকবে...

// এনভায়রনমেন্ট ভেরিয়েবল চেকিং
const JWT_KEY_RAW = Deno.env.get("JWT_SECRET") || "enterprise-super-secret-key-change-in-prod";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// JWT সাইনিং কী জেনারেশন
const encoder = new TextEncoder();
const keyBuf = encoder.encode(JWT_KEY_RAW);
const jwtCryptoKey = await crypto.subtle.importKey(
  "raw",
  keyBuf,
  { name: "HMAC", hash: "SHA-512" },
  false,
  ["sign", "verify"]
);

// ডেটাবেস টেবিল ও স্ট্রাকচার বুটস্ট্র্যাপ করা
await initializeDatabase();

// --- হেল্পার: ক্লায়েন্ট আইপি বের করা ---
function getClientIp(req: Request, info: Deno.ServeHandlerInfo): string {
  return req.headers.get("x-forwarded-for") || info.remoteAddr.hostname || "127.0.0.1";
}

// --- হেল্পার: মাল্টি-টেন্যান্ট সেশন ভেরিফিকেশন ---
async function getAuthenticatedSession(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const payload = await verify(token, jwtCryptoKey);
    return payload as { userId: string; orgId: string; role: string; subscriptionStatus: string };
  } catch {
    return null;
  }
}

// --- মেক্সিমাম সিকিউর রাউটিং হ্যান্ডলার ---
Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
  const url = new URL(req.url);
  const ipAddress = getClientIp(req, info);
  const userAgent = req.headers.get("user-agent") || "Unknown";

  // ১. স্ট্যাটিক ফ্রন্টএন্ড পরিবেশন (public/index.html)
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return new Response("Frontend index.html not found.", { status: 404 });
    }
  }

  // ২. স্ট্রাইপ এন্টারপ্রাইজ ওয়েবহুক লিসেনার (B2B Billing)
  if (req.method === "POST" && url.pathname === "/api/webhook/stripe") {
    const client = await pool.connect();
    try {
      const bodyText = await req.text();
      // প্রোডাকশনে স্ট্রাইপ সিগনেচার ভ্যালিডেশন এখানে ইমপ্লিমেন্ট করতে হবে (Stripe SDK দিয়ে)
      const event = JSON.parse(bodyText);

      if (event.type === "invoice.payment_succeeded" || event.type === "customer.subscription.updated") {
        const session = event.data.object;
        const stripeCustomerId = session.customer;
        const status = session.status === "active" ? "active" : "past_due";

        await client.queryObject(`
          UPDATE organizations 
          SET subscription_status = $1, subscription_ends_at = TO_TIMESTAMP($2)
          WHERE stripe_customer_id = $3
        `, [status, session.current_period_end || (Date.now() / 1000 + 2592000), stripeCustomerId]);
        
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }
    } catch (err) {
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    } finally {
      client.release();
    }
  }

  // ৩. এআই গভারনেন্স অ্যাসেসমেন্ট সাবমিশন ও ওয়েইটেড স্কোরিং ইঞ্জিন
  if (req.method === "POST" && url.pathname === "/api/assessment/submit") {
    const session = await getAuthenticatedSession(req);
    if (!session) return new Response("Unauthorized Execution", { status: 401 });
    if (session.subscriptionStatus !== "active") {
      return new Response("Active B2B Plan Required", { status: 403 });
    }

    const { orgId, userId } = session;
    const body = await req.json(); // এক্সপেক্টেড ফরম্যাট: { responses: [ { questionId, pillar, selectedScore, maxScore, questionText, recommendation } ] }
    const client = await pool.connect();

    try {
      // বিগ-৪ কমপ্লায়েন্স ওয়েইটেড রুলস
      const WEIGHTS: Record<string, number> = {
        STRATEGY: 0.25,
        DATA_GOVERNANCE: 0.25,
        TECHNICAL_COMPLIANCE: 0.30,
        CONTINUOUS_MONITORING: 0.20
      };

      const pillarTotals: Record<string, { max: number; actual: number }> = {
        STRATEGY: { max: 0, actual: 0 },
        DATA_GOVERNANCE: { max: 0, actual: 0 },
        TECHNICAL_COMPLIANCE: { max: 0, actual: 0 },
        CONTINUOUS_MONITORING: { max: 0, actual: 0 }
      };

      const gapAnalysis: any[] = [];

      // এটমিক ট্রানজেকশন প্রসেসিং শুরু
      await client.queryObject("BEGIN");

      for (const res of body.responses) {
        // ডেটাবেসে রেসপন্স সেভ/আপসার্ট করা (মাল্টি-টেন্যান্ট আইসোলেশন এনফোর্সড)
        await client.queryObject(`
          INSERT INTO assessment_responses (org_id, user_id, pillar, question_id, answer_value, score_awarded)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (org_id, question_id) 
          DO UPDATE SET user_id = $2, answer_value = $5, score_awarded = $6
        `, [orgId, userId, res.pillar, res.questionId, res.answerValue, res.selectedScore]);

        // স্কোর এগ্রিগেশন অবজেক্ট বিল্ড-আপ
        if (pillarTotals[res.pillar]) {
          pillarTotals[res.pillar].actual += res.selectedScore;
          pillarTotals[res.pillar].max += res.maxScore;
        }

        // গ্যাপ অ্যানালাইসিস ডিটেকশন (বিগ-৪ থ্রেশহোল্ড রুল: ফুল স্কোর না পেলে গ্যাপ হিসেবে গণ্য হবে)
        if (res.selectedScore < res.maxScore) {
          gapAnalysis.push({
            code: res.questionId,
            pillar: res.pillar,
            issue: `Incomplete alignment identified in: "${res.questionText}"`,
            remediation: res.recommendation || "Review organizational deployment strategy."
          });
        }
      }

      // প্রতিটি পিলারের পারসেন্টেজ বের করা
      const pillarScores: Record<string, number> = {};
      Object.keys(pillarTotals).forEach((key) => {
        const target = pillarTotals[key];
        pillarScores[key] = target.max > 0 ? parseFloat(((target.actual / target.max) * 100).toFixed(2)) : 0;
      });

      // চূড়ান্ত গ্লোবাল ওয়েইটেড ক্যালকুলেশন
      const overallScore = parseFloat(
        (
          (pillarScores["STRATEGY"] || 0) * WEIGHTS.STRATEGY +
          (pillarScores["DATA_GOVERNANCE"] || 0) * WEIGHTS.DATA_GOVERNANCE +
          (pillarScores["TECHNICAL_COMPLIANCE"] || 0) * WEIGHTS.TECHNICAL_COMPLIANCE +
          (pillarScores["CONTINUOUS_MONITORING"] || 0) * WEIGHTS.CONTINUOUS_MONITORING
        ).toFixed(2)
      );

      // রেডিনেস রিপোর্ট পারসিস্ট করা
      const reportResult = await client.queryObject<{ id: string }>(`
        INSERT INTO readiness_reports (org_id, overall_score, pillar_scores, gap_analysis, generated_by)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [orgId, overallScore, JSON.stringify(pillarScores), JSON.stringify(gapAnalysis), session.userId]);

      const reportId = reportResult.rows[0].id;

      // ট্রানজেকশন সফলভাবে শেষ করা
      await client.queryObject("COMMIT");

      // অডিট ট্রেইল সিকিউর করা (বিগ-৪ নন-রিপুডিয়েশন গ্যারান্টি)
      await logAuditAction(orgId, userId, "COMPLIANCE_ASSESSMENT_SUBMITTED", ipAddress, userAgent, {
        reportId,
        overallScore
      });

      return new Response(JSON.stringify({
        success: true,
        reportId,
        overallScore,
        pillarScores,
        gapAnalysis
      }), { status: 200, headers: { "content-type": "application/json" } });

    } catch (error) {
      await client.queryObject("ROLLBACK");
      console.error("Governance engine crash pipeline failure:", error);
      return new Response("Internal Engine Transaction Failure", { status: 500 });
    } finally {
      client.release();
    }
  }

  return new Response("Route endpoint not matched", { status: 404 });
});