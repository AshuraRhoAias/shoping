import "./globals.css";

export const metadata = {
  title: "Shop Admin",
  description: "Panel de administración",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
