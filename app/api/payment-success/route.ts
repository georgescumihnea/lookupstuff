import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

// Verify the callback data from Plisio
function verifyCallbackData(data: any): boolean {
  if (!data.verify_hash || !process.env.PLISIO_SECRET_KEY) {
    return false;
  }

  const verifyHash = data.verify_hash;
  const ordered = { ...data };
  delete ordered.verify_hash;

  // Convert expire_utc to string if it exists
  if (ordered.expire_utc) {
    ordered.expire_utc = ordered.expire_utc.toString();
  }

  // Handle tx_urls special case
  if (ordered.tx_urls) {
    ordered.tx_urls = decodeURIComponent(ordered.tx_urls);
  }

  const string = JSON.stringify(ordered);
  const hmac = crypto.createHmac("sha1", process.env.PLISIO_SECRET_KEY);
  hmac.update(string);
  const hash = hmac.digest("hex");

  return hash === verifyHash;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Verify the callback data
    if (!verifyCallbackData(data)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Log successful payment
    console.log("Payment successful:", {
      order_number: data.order_number,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
    });

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?payment=success`
    );
  } catch (error: any) {
    console.error("Payment success callback error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
