import { QRCode } from "@/components/ui/qr-code";
import { Countdown } from "@/components/ui/countdown";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentData: PaymentData | null;
}

export function PaymentDialog({
  open,
  onOpenChange,
  paymentData,
}: PaymentDialogProps) {
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  if (!paymentData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completa tu pago</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6">
          <div className="flex flex-col items-center gap-4">
            {paymentData.qr_code ? (
              <img
                src={paymentData.qr_code}
                alt="Payment QR Code"
                className="w-[200px] h-[200px]"
              />
            ) : (
              <QRCode
                value={`${paymentData.currency?.toLowerCase()}:${paymentData.wallet_hash}?amount=${paymentData.amount}`}
                size={200}
              />
            )}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Envía exactamente</p>
              <p className="text-xl font-bold">
                {paymentData.amount || "0"} {paymentData.currency || ""}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentData.credits || 0} Créditos
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg w-full">
              <input
                type="text"
                value={paymentData.wallet_hash || ""}
                readOnly
                className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(paymentData.wallet_hash || "")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {paymentData.invoice_commission && (
              <div className="space-y-2 text-sm w-full">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Comisión de la red:
                  </span>
                  <span>
                    {paymentData.invoice_commission} {paymentData.currency}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>
                    {paymentData.invoice_total_sum || paymentData.amount}{" "}
                    {paymentData.currency}
                  </span>
                </div>
              </div>
            )}
          </div>

          {paymentData.expire_utc && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">El pago expira en</p>
              <Countdown date={new Date(paymentData.expire_utc * 1000)} />
              <p className="text-sm text-muted-foreground mt-4">
                Nota: Si cierras esta ventana, tu transacción continuará siendo
                activa. Puedes ver y completarla más tarde en tu página de
                transacciones.
              </p>
              <Link href="/user-transactions">
                <Button variant="outline" className="mt-2">
                  Ver transacciones
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
