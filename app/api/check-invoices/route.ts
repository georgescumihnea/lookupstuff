import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const PLISIO_SECRET_KEY = process.env.PLISIO_SECRET_KEY!;

async function getInvoiceStatus(txn_id: string) {
  try {
    const response = await fetch(
      `https://api.plisio.net/api/v1/operations/${txn_id}?api_key=${PLISIO_SECRET_KEY}`
    );
    const data = await response.json();

    if (data.status === "success") {
      return {
        status: data.data.status,
        amount: data.data.amount,
        crypto_amount: data.data.crypto_amount,
        crypto_currency: data.data.psys_cid,
        exchange_rate: data.data.source_rate,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching invoice status:", error);
    return null;
  }
}

export async function GET() {
  try {
    // First, update all existing transactions that haven't been checked yet
    const { data: pendingTransactions } = await supabase
      .from("transactions")
      .select("*")
      .in("status", ["new", "pending"]);

    if (pendingTransactions) {
      for (const transaction of pendingTransactions) {
        const invoiceStatus = await getInvoiceStatus(transaction.payment_id);

        if (invoiceStatus) {
          await supabase
            .from("transactions")
            .update({
              status: invoiceStatus.status,
              crypto_amount: invoiceStatus.crypto_amount,
              crypto_currency: invoiceStatus.crypto_currency,
              exchange_rate: invoiceStatus.exchange_rate,
              updated_at: new Date().toISOString(),
            })
            .eq("id", transaction.id);
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error checking invoices:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to check invoices" },
      { status: 500 }
    );
  }
}
