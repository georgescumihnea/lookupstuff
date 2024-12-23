"use client";

import ReactQRCode from "react-qr-code";

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 256 }: QRCodeProps) {
  return (
    <div className="p-2 bg-white rounded-lg">
      <ReactQRCode value={value} size={size} />
    </div>
  );
}
