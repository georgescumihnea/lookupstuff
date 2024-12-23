"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { PaymentDialog } from "@/components/payment-dialog";

const CREDIT_PACKAGES = [
  { id: "1", credits: 20, price: 20 },
  { id: "2", credits: 100, price: 180 },
  { id: "3", credits: 200, price: 320 },
];

interface Currency {
  id: string;
  name: string;
  icon: ReactNode;
}

const SUPPORTED_CURRENCIES: Currency[] = [
  {
    id: "BTC",
    name: "Bitcoin",
    icon: (
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
      >
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#FFF"
            fillRule="nonzero"
            d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.745-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"
          />
        </g>
      </svg>
    ),
  },
  {
    id: "LTC",
    name: "Litecoin",
    icon: (
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
      >
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#BFBBBB" />
          <path
            fill="#FFF"
            d="M10.427 19.214L9 19.768l.688-2.759 1.444-.58L13.213 8h5.129l-1.519 6.196 1.41-.571-.68 2.75-1.427.571-.848 3.483H23L22.127 24H9.252z"
          />
        </g>
      </svg>
    ),
  },
  {
    id: "XMR",
    name: "Monero",
    icon: (
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
      >
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#FF6600" />
          <path
            fill="#FFF"
            fillRule="nonzero"
            d="M15.97 5.235c5.985 0 10.825 4.84 10.825 10.824a11.07 11.07 0 01-.558 3.432h-3.226v-9.094l-7.04 7.04-7.04-7.04v9.094H5.704a11.07 11.07 0 01-.557-3.432c0-5.984 4.84-10.824 10.824-10.824zM14.358 18.02L16 19.635l1.613-1.614 3.051-3.08v5.72h4.547a10.806 10.806 0 01-9.24 5.192c-3.902 0-7.334-2.082-9.24-5.192h4.546v-5.72l3.08 3.08z"
          />
        </g>
      </svg>
    ),
  },
  {
    id: "ETH",
    name: "Ethereum",
    icon: (
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
      >
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <g fill="#FFF" fillRule="nonzero">
            <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z" />
            <path d="M16.498 4L9 16.22l7.498-3.35z" />
            <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z" />
            <path d="M16.498 27.995v-6.028L9 17.616z" />
            <path
              fillOpacity=".2"
              d="M16.498 20.573l7.497-4.353-7.497-3.348z"
            />
            <path fillOpacity=".602" d="M9 16.22l7.498 4.353v-7.701z" />
          </g>
        </g>
      </svg>
    ),
  },
];

interface PaymentData {
  txn_id: string;
  invoice_url: string;
  amount?: string;
  credits?: number;
  pending_amount?: string;
  wallet_hash?: string;
  psys_cid?: string;
  currency?: string;
  status?: string;
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

export default function BuyCredits() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[0]);
  const [selectedCurrency, setSelectedCurrency] = useState(
    SUPPORTED_CURRENCIES[0]
  );
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      if (session?.user?.username) {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("username", session.user.username)
          .single();

        if (userData) {
          setUserId(userData.id);
        }
      }
    };

    fetchUserId();
  }, [session]);

  const handlePurchase = async () => {
    try {
      setLoading(true);

      if (!session?.user?.username || !userId) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedPackage.price,
          userId: userId,
          credits: selectedPackage.credits,
          currency: selectedCurrency.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create invoice");
      }

      const data = await response.json();

      if (data.status === "success") {
        setPaymentData({
          ...data.data,
          credits: selectedPackage.credits,
        });
        setShowPaymentDialog(true);
      } else {
        throw new Error(data.message || "Failed to create invoice");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <RadioGroup
              defaultValue={selectedPackage.id}
              onValueChange={(value) =>
                setSelectedPackage(CREDIT_PACKAGES.find((p) => p.id === value)!)
              }
              className="grid gap-4"
            >
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center space-x-2 p-4 rounded-lg border border-border hover:border-primary transition-all"
                >
                  <RadioGroupItem value={pkg.id} id={`package-${pkg.id}`} />
                  <Label
                    htmlFor={`package-${pkg.id}`}
                    className="flex flex-1 justify-between"
                  >
                    <span>{pkg.credits} Créditos</span>
                    <span>{pkg.price} €</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="space-y-2">
              <Label>Selecciona la moneda de pago</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <button
                    key={currency.id}
                    onClick={() => setSelectedCurrency(currency)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      selectedCurrency.id === currency.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {currency.icon}
                    <span className="text-sm font-medium mt-2">
                      {currency.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handlePurchase}
              disabled={loading || !session || !userId}
              className="w-full"
            >
              {!session
                ? "Por favor, inicia sesión"
                : loading
                  ? "Procesando..."
                  : `Comprar ${selectedPackage.credits} Créditos con ${selectedCurrency.name}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        paymentData={paymentData}
      />
    </>
  );
}
