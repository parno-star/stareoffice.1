import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface LetterQRCodeProps {
  code: string;
  size?: number;
  className?: string;
}

// Renders a QR code image that links to the public letter verification page.
// The outer wrapper always carries `data-letter-qr`, and it is marked
// `data-qr-ready="true"` only once the QR image has actually been generated.
// The print/PDF capture pipeline (renderLetterImage) waits for this flag so the
// snapshot never fires before the async QR has rendered.
export default function LetterQRCode({ code, size = 96, className }: LetterQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const verifyUrl = `${window.location.origin}/verifikasi-surat/${encodeURIComponent(code)}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(verifyUrl, {
      width: size * 2, // render at 2x for crisp print output
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [verifyUrl, size]);

  return (
    <span
      data-letter-qr
      data-qr-ready={dataUrl ? "true" : "false"}
      style={{ display: "inline-block", width: size, height: size }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR verifikasi surat"
          width={size}
          height={size}
          className={className}
          style={{ imageRendering: "pixelated", display: "block" }}
        />
      ) : (
        <span
          className={className}
          style={{ display: "block", width: size, height: size, background: "#f1f5f9", borderRadius: 4 }}
        />
      )}
    </span>
  );
}
