#!/usr/bin/env tsx
/**
 * Test script to verify one-time token generation works with manual session
 */

import { config } from "dotenv";
config();

import crypto from "crypto";
import { auth } from "@/lib/auth";

async function testTokenGeneration() {
  try {
    console.log("Testing one-time token generation with manual session...\n");

    const userId = "dr4XkWadrXtV9iJ28JOzLwDk8hhfdLBw";
    const pool = auth.options.database as any;

    console.log("Creating temporary session...");

    // Create a temporary session manually
    const sessionId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO session (id, token, "userId", "expiresAt", "ipAddress", "userAgent", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [sessionId, sessionToken, userId, sessionExpiresAt, 'server', 'test-script']
    );

    console.log("Generating OTT with manual session via HTTP...");

    // Make HTTP request to OTT endpoint with session cookie
    // Use the secure cookie name since useSecureCookies: true in config
    const response = await fetch('http://localhost:3000/api/auth/one-time-token/generate', {
      method: 'GET',
      headers: {
        'Cookie': `__Secure-better-auth.session_token=${sessionToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OTT generation failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json();

    // Clean up temp session
    await pool.query('DELETE FROM session WHERE id = $1', [sessionId]);
    console.log("Temporary session cleaned up");

    console.log("\n✅ Token generated:", {
      token: tokenData.token?.substring(0, 20) + "...",
    });

    // Check if token was stored in database
    const result = await pool.query(
      'SELECT id, "userId", "expiresAt" FROM one_time_token ORDER BY "createdAt" DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      console.log("\n✅ Token found in database:", {
        userId: result.rows[0].userId,
        expiresAt: result.rows[0].expiresAt,
      });
    } else {
      console.log("\n❌ Token NOT found in database!");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Failed to generate token:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    process.exit(1);
  }
}

testTokenGeneration();
