import { verifyToken } from '@/lib/authJWT';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Reuse the shared jose-based verifier so auth logic lives in one place
  // (instead of a second, jsonwebtoken-based implementation here).
  const decoded = await verifyToken(request);
  const isAuthenticated = decoded !== null;
  return NextResponse.json({ isAuthenticated, success: isAuthenticated });
}
