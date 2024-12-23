"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PaymentDialog } from "@/components/payment-dialog";
import { env } from "@/env.mjs";
import { toast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  user_id: string;
  amount: string;
  credits: number;
  status: string;
  payment_id?: string;
  txn_id: string;
  invoice_url: string;
  pending_amount?: string;
  crypto_amount?: string;
  crypto_currency?: string;
  exchange_rate?: string;
  created_at: string;
  order_number?: string;
  expires_at?: string;
  wallet_hash?: string;
  psys_cid?: string;
  currency?: string;
  source_currency?: string;
  source_rate?: string;
  expire_utc?: number;
  expected_confirmations?: string;
  qr_code?: string;
  verify_hash?: string;
  invoice_commission?: string;
  invoice_sum?: string;
  invoice_total_sum?: string;
}

function CountdownTimer({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiryDate).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiryDate]);

  return <span className="font-mono">{timeLeft}</span>;
}

export default function UserTransactionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const filteredTransactions = transactions.filter((transaction) => {
    const searchText =
      `${transaction.order_number} ${transaction.status}`.toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    if (session?.user?.username) {
      fetchUserTransactions();
    }
  }, [session]);

  const fetchUserTransactions = async () => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("username", session?.user?.username)
        .single();

      if (userData) {
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userData.id)
          .order("created_at", { ascending: false });

        if (transactionsData) {
          setTransactions(transactionsData);
        }
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async (transaction: Transaction) => {
    try {
      setLoadingPayment(true);
      const response = await fetch(
        `/api/plisio?` +
          new URLSearchParams({
            source_currency: transaction.source_currency || "EUR",
            source_amount: transaction.amount,
            order_number: transaction.order_number || transaction.id,
            order_name: `Credits Purchase - ${transaction.order_number || transaction.id}`,
            currency: transaction.crypto_currency || "BTC",
          })
      );

      const data = await response.json();

      if (data.status === "success") {
        const updatedTransaction = {
          ...transaction,
          wallet_hash: data.data.wallet_hash,
          qr_code: data.data.qr_code,
          invoice_commission: data.data.invoice_commission,
          invoice_sum: data.data.invoice_sum,
          invoice_total_sum: data.data.invoice_total_sum,
          expire_utc: data.data.expire_utc,
          amount: data.data.amount,
          currency: data.data.currency,
        };

        setSelectedTransaction(updatedTransaction);
        setShowPaymentDialog(true);
      } else {
        toast({
          title: "Error",
          description:
            data.data?.message || "Failed to get payment information",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching payment information:", error);
      toast({
        title: "Error",
        description: "Failed to get payment information",
        variant: "destructive",
      });
    } finally {
      setLoadingPayment(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Your Transactions</CardTitle>
          </div>
          <div className="mt-2">
            <Input
              placeholder="Search by order number or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No transactions found
                </div>
              ) : (
                filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="border p-4 rounded-lg bg-card"
                  >
                    <div className="font-medium">
                      Order #{transaction.order_number}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-muted-foreground text-sm">
                          Amount: €{parseFloat(transaction.amount).toFixed(2)}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Credits: {transaction.credits}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Status:{" "}
                          <span
                            className={
                              transaction.status === "completed"
                                ? "text-green-500"
                                : transaction.status === "failed"
                                  ? "text-red-500"
                                  : "text-yellow-500"
                            }
                          >
                            {transaction.status}
                          </span>
                          {transaction.expires_at &&
                            transaction.status === "new" && (
                              <span className="ml-2">
                                (Expires in:{" "}
                                <CountdownTimer
                                  expiryDate={transaction.expires_at}
                                />
                                )
                              </span>
                            )}
                        </div>
                      </div>
                      {transaction.crypto_amount && (
                        <div>
                          <div className="text-muted-foreground text-sm">
                            Crypto Amount: {transaction.crypto_amount}{" "}
                            {transaction.crypto_currency}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Exchange Rate: {transaction.exchange_rate}
                          </div>
                          {transaction.wallet_hash && (
                            <div className="text-muted-foreground text-sm">
                              Wallet Address: {transaction.wallet_hash}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {transaction.status === "new" && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          onClick={() => handleCompletePayment(transaction)}
                          disabled={loadingPayment}
                          className="text-sm"
                        >
                          {loadingPayment ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading Payment...
                            </>
                          ) : (
                            "Complete Payment"
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="text-muted-foreground text-xs mt-2">
                      Created:{" "}
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        paymentData={selectedTransaction}
      />
    </div>
  );
}