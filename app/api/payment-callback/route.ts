import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

const verifyPlisioCallback = (data: any) => {
  if (!data.verify_hash) {
    return false;
  }

  const verifyHash = data.verify_hash;
  delete data.verify_hash;

  // Sort data by keys
  const ordered = Object.keys(data)
    .sort()
    .reduce((obj: any, key: string) => {
      obj[key] = data[key];
      return obj;
    }, {});

  // Convert expire_utc to string if it exists
  if (ordered.expire_utc) {
    ordered.expire_utc = ordered.expire_utc.toString();
  }

  // Handle tx_urls special case
  if (ordered.tx_urls) {
    ordered.tx_urls = decodeURIComponent(ordered.tx_urls);
  }

  const dataString = JSON.stringify(ordered);
  const hmac = crypto.createHmac("sha1", process.env.PLISIO_SECRET_KEY!);
  hmac.update(dataString);
  const calculatedHash = hmac.digest("hex");

  return calculatedHash === verifyHash;
};

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Verify the callback data
    if (!verifyPlisioCallback(data)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Get the transaction from our database
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("*")
      .eq("payment_id", data.txn_id)
      .single();

    if (transactionError || !transaction) {
      console.error("Transaction not found:", data.txn_id);
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: data.status,
        crypto_amount: data.amount,
        crypto_currency: data.currency,
        exchange_rate: data.source_rate,
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", data.txn_id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    // If payment is completed, credit the user's account
    if (data.status === "completed") {
      const { error: creditError } = await supabase.rpc("add_credits", {
        p_user_id: transaction.user_id,
        p_credits: transaction.credits,
      });

      if (creditError) {
        console.error("Failed to add credits:", creditError);
        return NextResponse.json(
          { error: "Failed to add credits" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Payment callback error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
