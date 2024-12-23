import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const data = await request.json();

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

    // Update transaction status to completed if not already
    if (transaction.status !== "completed") {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "completed",
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

      // Add credits to user's account
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
    console.error("Success callback error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
