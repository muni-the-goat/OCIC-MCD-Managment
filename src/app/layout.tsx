import type { Metadata, Viewport } from "next";
import { Fustat, Geist_Mono, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

// OCIC type system: Fustat (display), Poppins (body/UI), Montserrat (labels).
// These are the faces on Windows and Android; on Apple platforms globals.css
// puts the system font (SF Pro) in front of all three.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
});

const fustat = Fustat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-fustat",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Without viewport-fit=cover, env(safe-area-inset-bottom) resolves to 0 on a
// notched iPhone and the tab bar sits under the home indicator. The width and
// scale are Next's own defaults, restated because declaring this export
// replaces the tag it would otherwise write for us.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "MCD Management · OCIC",
    template: "%s · MCD Management",
  },
  description: "OCIC internal office report tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        poppins.variable,
        fustat.variable,
        montserrat.variable,
        geistMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
