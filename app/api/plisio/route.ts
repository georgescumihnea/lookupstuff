import { env } from "@/env.mjs";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source_currency = searchParams.get("source_currency");
  const source_amount = searchParams.get("source_amount");
  const order_number = searchParams.get("order_number");
  const order_name = searchParams.get("order_name");
  const currency = searchParams.get("currency");

  try {
    const response = await fetch(
      `https://api.plisio.net/api/v1/invoices/new?` +
        new URLSearchParams({
          source_currency: source_currency || "EUR",
          source_amount: source_amount || "",
          order_number: order_number || "",
          order_name: order_name || `Credits Purchase - ${order_number}`,
          currency: currency || "BTC",
          api_key: env.PLISIO_SECRET_KEY,
          return_existing: "true",
        })
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching from Plisio:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch from Plisio" },
      { status: 500 }
    );
  }
}
