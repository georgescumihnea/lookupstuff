"use client";

import BuyCredits from "@/components/buy-credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BuyCreditsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Buy Credits</CardTitle>
          <p className="text-sm text-muted-foreground">
            Purchase credits to use for lookups. Select an amount and complete
            the payment.
          </p>
        </CardHeader>
        <CardContent>
          <BuyCredits />
        </CardContent>
      </Card>
    </div>
  );
}
