import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuakaan Management System | Nidaamka Dukaanka",
  description: "Nidaam casri ah oo loogu talagalay maamulka dukaamada tafaariiqda, xisaabinta iibka, kaydka, daymaha iyo faa'iidada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="so">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
