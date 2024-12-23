import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

// Ensure we have a base URL, fallback to localhost if not set
const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(request: Request) {
  try {
    // Check if we have the API key
    if (!process.env.PLISIO_SECRET_KEY) {
      console.error("Missing PLISIO_SECRET_KEY environment variable");
      return NextResponse.json(
        { error: "Payment service configuration error" },
        { status: 500 }
      );
    }

    // Check authentication with proper auth config
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Received request body:", body);

    const { amount, credits, userId, currency = "BTC" } = body;

    if (!amount || !credits || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the user exists and matches the session
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Database error when fetching user:", userError);
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 }
      );
    }

    if (!userData || userData.username !== session.user.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate currency
    const SUPPORTED_CURRENCIES = [
      "ETH",
      "BTC",
      "LTC",
      "DASH",
      "ZEC",
      "DOGE",
      "BCH",
      "XMR",
      "USDT",
      "USDC",
      "SHIB",
      "BTT_TRX",
      "USDT_TRX",
      "TRX",
      "BNB",
      "BUSD",
      "USDT_BSC",
      "ETC",
      "TON",
    ];
    if (!SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return NextResponse.json(
        {
          error: `Unsupported cryptocurrency. Please choose from: ${SUPPORTED_CURRENCIES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Create unique order number
    const orderNumber = `PEDIDO-${Date.now()}-${userId.slice(0, 8)}`;

    try {
      // Prepare Plisio API request URL with only required parameters
      const apiUrl = new URL("https://api.plisio.net/api/v1/invoices/new");
      const params = new URLSearchParams({
        api_key: process.env.PLISIO_SECRET_KEY!,
        order_number: orderNumber,
        order_name: `Credits Purchase - ${credits} credits`,
        source_currency: "EUR",
        source_amount: amount.toString(),
        currency: currency.toUpperCase(),
        email: userData.username,
        callback_url: `${baseUrl}/api/payment-callback?json=true`,
      });

      console.log(
        "Calling Plisio API URL:",
        `${apiUrl.toString()}?${params.toString()}`
      );

      // Make request to Plisio API first
      const response = await fetch(
        `${apiUrl.toString()}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const responseText = await response.text();
      console.log("Raw Plisio response:", responseText);

      let plisioResponse;
      try {
        plisioResponse = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse Plisio response:", e);
        throw new Error("Invalid response from payment provider");
      }

      console.log(
        "Parsed Plisio response:",
        JSON.stringify(plisioResponse, null, 2)
      );

      if (!response.ok || plisioResponse.status !== "success") {
        throw new Error(
          plisioResponse.data?.message || "Failed to create invoice"
        );
      }

      // Create transaction record with all Plisio data
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          amount: amount,
          credits: credits,
          type: "credit_purchase",
          status: "new",
          order_number: orderNumber,
          payment_id: plisioResponse.data.txn_id,
          invoice_url: plisioResponse.data.invoice_url,
          crypto_amount: plisioResponse.data.amount,
          crypto_currency: plisioResponse.data.psys_cid,
          exchange_rate: plisioResponse.data.source_rate,
          qr_code: plisioResponse.data.qr_code,
          expires_at: plisioResponse.data.expire_utc
            ? new Date(plisioResponse.data.expire_utc * 1000).toISOString()
            : null,
          invoice_commission: plisioResponse.data.invoice_commission,
          invoice_total_sum: plisioResponse.data.invoice_total_sum,
        })
        .select()
        .single();

      if (transactionError) {
        console.error("Failed to create transaction:", transactionError);
        throw new Error("Failed to create transaction record");
      }

      return NextResponse.json(plisioResponse);
    } catch (error: any) {
      console.error("Operation failed:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    // Ensure we always return a proper JSON response
    return NextResponse.json(
      {
        error: error.message || "Failed to create invoice",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
