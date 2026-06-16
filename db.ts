// db.ts - 完全 Mock Layer (Zero Dependencies)

// একটি ডামি পুল অবজেক্ট যাতে server.ts ক্র্যাশ না করে
export const pool = {
  connect: async () => {
    return {
      queryObject: async (queryObj: any) => {
        // কোনো রিয়েল কুয়েরি রান হবে না, জাস্ট সাকসেস রিটার্ন করবে
        console.log("🛠️ [Mock DB Query Executed]:", typeof queryObj === 'string' ? queryObj.substring(0, 60) + "..." : queryObj.text);
        return { rows: [{ id: "mock-uuid-12345" }] };
      },
      release: () => {}
    };
  }
};

// ডাটাবেস ইনিশিয়ালাইজেশন সাকসেস ইমিটেশন
export async function initializeDatabase() {
  console.log("🔒 [SIMULATED] Enterprise Database Schema Verified & Indexed Successfully.");
}

// ইমিউটেবল অডিট লগ রাইটার (কনসোলে প্রিন্ট হবে)
export async function logAuditAction(
  orgId: string,
  userId: string | null,
  action: string,
  ipAddress: string,
  userAgent: string,
  payload: Record<string, unknown> | null = null
) {
  console.log(`📝 [AUDIT LOG ATTESTATION] Action: ${action} | Tenant: ${orgId} | IP: ${ipAddress}`);
}