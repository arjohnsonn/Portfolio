import Navbar from "@/components/navbar";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata = {
  title: "Aiden Johnson",
  description: "A developer & aspiring software engineer from Prosper, TX",
  openGraph: {
    title: "Aiden Johnson",
    description: "A developer & aspiring software engineer from Prosper, TX",
    url: "https://aidenjohnson.dev",
    images: [
      {
        url: "https://i.imgur.com/xnxxiip.png",
      },
    ],
  },
  themeColor: "#F54242",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}
        <TooltipProvider>
          <Navbar />
        </TooltipProvider>
      </body>
    </html>
  );
}
