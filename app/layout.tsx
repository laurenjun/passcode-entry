import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PasscodeMotionProvider from "@/components/PasscodeEntry/MotionProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "block",
});

export const metadata: Metadata = {
  title: "Passcode Entry",
  description: "Static visual states of the 4-digit passcode entry component.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PasscodeMotionProvider>{children}</PasscodeMotionProvider>
      </body>
    </html>
  );
}
