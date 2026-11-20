import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM en vivo — vende-ia",
  description: "Leads de WhatsApp calificados por IA: pipeline, conversaciones y derivaciones en tiempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${hanken.variable} h-full antialiased`}>
      <head>
        {/* Aplica el tema guardado antes del paint (evita parpadeo). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var v=JSON.parse(localStorage.getItem('tema-vars')||'null');if(v){var e=document.documentElement;for(var k in v){e.style.setProperty('--'+k,v[k])}}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
