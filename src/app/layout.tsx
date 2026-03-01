import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixSign",
  description: "Electronic signature platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "!bg-white !text-slate-800 !border !border-slate-200 dark:!bg-neutral-800 dark:!text-neutral-100 dark:!border-neutral-700",
              style: { borderRadius: "12px", fontSize: "14px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
              success: { iconTheme: { primary: "#22c55e", secondary: "#ffffff" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#ffffff" } },
            }}
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
