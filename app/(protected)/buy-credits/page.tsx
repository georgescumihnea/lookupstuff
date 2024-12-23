"use client";

import BuyCredits from "@/components/buy-credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BuyCreditsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Comprar Créditos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compra créditos para usar para búsquedas. Selecciona una cantidad y
            completa el pago.
          </p>
        </CardHeader>
        <CardContent>
          <BuyCredits />
        </CardContent>
      </Card>
    </div>
  );
}
