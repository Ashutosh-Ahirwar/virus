import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Define the Mini App Embed JSON
// This tells Farcaster how to render your app in the feed
const miniAppEmbed = {
  version: "1",
  imageUrl: "https://virus-orcin.vercel.app/hero.png", // Must be 3:2 aspect ratio
  button: {
    title: "Mint your Strain",
    action: {
      type: "launch_frame", // "launch_frame" is used for backward compatibility with older clients
      name: "Viral Strain",
      url: "https://virus-orcin.vercel.app",
      splashImageUrl: "https://virus-orcin.vercel.app/splash.png",
      splashBackgroundColor: "#000000",
    },
  },
};

export const metadata: Metadata = {
  title: "Viral Strain",
  description: "Generate a sentient virus from any FID — evolve, adapt, and shape the future.",
  // 2. Add OpenGraph tags for better preview on other platforms (like Discord/Twitter)
  openGraph: {
    title: "Viral Strain",
    description: "Generate a sentient virus from any FID — evolve, adapt, and shape the future.",
    images: ["https://virus-orcin.vercel.app/hero.png"],
  },
  // 3. Add the Farcaster specific meta tags
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "fc:frame": JSON.stringify(miniAppEmbed), // Required for legacy support
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}