import "./globals.css";

export const metadata = {
  title: "Shop Admin",
  description: "Panel de administración",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
