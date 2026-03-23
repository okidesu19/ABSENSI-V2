import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIABSENSI - Sistem Absensi Berbasis Face Recognition",
  description: "Sistem Absensi Sekolah dengan Face Recognition menggunakan Firebase Realtime Database",
  keywords: ["Absensi", "Face Recognition", "Sekolah", "Firebase", "Attendance System"],
  authors: [{ name: "SIABSENSI Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SIABSENSI",
    description: "Sistem Absensi Berbasis Face Recognition",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
