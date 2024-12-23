import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Get all transactions
    const { data: transactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    // Group transactions by order_number
    const transactionGroups = transactions?.reduce(
      (groups: { [key: string]: any[] }, transaction) => {
        const orderNumber = transaction.order_number || "null";
        if (!groups[orderNumber]) {
          groups[orderNumber] = [];
        }
        groups[orderNumber].push(transaction);
        return groups;
      },
      {}
    );

    let deletedCount = 0;

    // For each group of transactions with the same order_number
    for (const orderNumber in transactionGroups) {
      const group = transactionGroups[orderNumber];
      if (group.length > 1) {
        // Keep the most complete record (the one with payment_id)
        const completeRecord = group.find((t) => t.payment_id);
        const duplicateIds = group
          .filter((t) => t.id !== (completeRecord?.id || group[0].id))
          .map((t) => t.id);

        if (duplicateIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("transactions")
            .delete()
            .in("id", duplicateIds);

          if (deleteError) {
            console.error("Error deleting duplicates:", deleteError);
          } else {
            deletedCount += duplicateIds.length;
          }
        }
      }
    }

    return NextResponse.json({
      status: "success",
      message: `Cleaned up ${deletedCount} duplicate transactions`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to clean up transactions" },
      { status: 500 }
    );
  }
}
