// server.ts - Core Full-Stack Engine

// ১. রিস্ক ক্যালকুলেটর ফাংশন (Core Logic)
function analyzeRisk(systemName: string, modelType: string) {
  let riskScore = 40;
  let summary = "Minimal Risk";

  if (modelType === "llm" || modelType === "recruitment") {
    riskScore = 85;
    summary = "High Risk (Requires Independent Technical Audit)";
  } else if (modelType === "biometric") {
    riskScore = 95;
    summary = "Critical Risk / Unacceptable (Strict EU AI Act Prohibitions)";
  }

  return {
    systemName,
    modelType,
    riskScore,
    summary,
    auditTimestamp: new Date().toISOString()
  };
}

// ২. HTTP সার্ভার রিকোয়েস্ট হ্যান্ডলার
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // রুট ১: ফ্রন্টএন্ড UI সার্ভ করা (GET /)
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return new Response("Frontend file not found", { status: 500 });
    }
  }

  // রুট ২: অডিট এপিআই এন্ডপয়েন্ট (POST /api/audit)
  if (req.method === "POST" && url.pathname === "/api/audit") {
    try {
      const body = await req.json();
      const { systemName, modelType } = body;

      if (!systemName || !modelType) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
      }

      // লজিক রান করানো
      const result = analyzeRisk(systemName, modelType);

      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid Request" }), { status: 400 });
    }
  }

  // রুট ৩: ক্যাচ-অল ৪০৪
  return new Response("Not Found", { status: 404 });
}

// ৩. সার্ভার স্টার্ট (Base44 পোর্টের সাথে অ্যালাইনড)
const port = parseInt(Deno.env.get("PORT") || "3000");
console.log(`🚀 VerifAI Engine running live on http://localhost:${port}`);
Deno.serve({ port }, handler);