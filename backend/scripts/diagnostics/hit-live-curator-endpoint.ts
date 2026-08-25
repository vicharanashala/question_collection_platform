// Diagnostic script — hits the live NestJS API the same way the web dashboard does,
// to prove the curator-endpoint fix end-to-end. Uses verify-otp (dev accepts any
// 6-digit code) to mint a token for the seeded curator (Rishabh Shukla, +918433489789).
import 'dotenv/config';

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const MOBILE = process.env.MOBILE ?? '+918433489789';
const OTP = process.env.OTP ?? '000000';

async function main() {
  const otpRes = await fetch(`${BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: MOBILE, otp: OTP }),
  });
  console.log(`[verify-otp] HTTP ${otpRes.status}`);
  const otpJson = (await otpRes.json()) as {
    message?: string;
    statusCode?: number;
    tokens?: { accessToken: string; refreshToken: string };
    user?: { id: string; role: string };
  };
  if (!otpJson.tokens) {
    console.error('[verify-otp] no tokens:', otpJson);
    process.exit(1);
  }
  console.log(`[verify-otp] tokens minted for role=${otpJson.user?.role}`);

  const curatorRes = await fetch(`${BASE}/curator/stats`, {
    headers: { Authorization: `Bearer ${otpJson.tokens.accessToken}` },
  });
  console.log(`[curator/stats] HTTP ${curatorRes.status}`);
  const curatorJson = (await curatorRes.json()) as Record<string, unknown>;
  console.log(JSON.stringify(curatorJson, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });