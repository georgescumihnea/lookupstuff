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

    // Update transaction status to failed
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "failed",
        crypto_amount: data.amount,
        crypto_currency: data.currency,
        exchange_rate: data.source_rate,
      })
      .eq("order_number", data.order_number);

    if (updateError) {
      throw new Error("Failed to update transaction");
    }

    // Log failed payment
    console.error("Payment failed:", {
      order_number: data.order_number,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      error: data.error,
    });

    // Redirect to failure page
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?payment=failed`
    );
  } catch (error: any) {
    console.error("Payment failed callback error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
