import "./globals.css";
import { Public_Sans } from "next/font/google";


const publicSans = Public_Sans({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Hotel Assistant</title>
      </head>
      <body className={publicSans.className}>
        <div className="flex flex-col py-4 px-4 md:px-12 h-[100vh] bg-[#02040F]">
          {children}
        </div>
      </body>
    </html>
  );
}