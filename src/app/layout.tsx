import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Assistant",
  description: "Chat-based task management powered by Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
