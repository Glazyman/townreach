import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0266ff",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.06em",
          fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif'
        }}
      >
        TR
      </div>
    ),
    { ...size }
  );
}
