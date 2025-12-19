"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import {
  Car,
  Calendar,
  DollarSign,
  Users,
  FileText,
  LogOut,
  Menu,
  ChartArea,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useState } from "react";
import Image from "next/image";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  if (loading || !profile) {
    return null;
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: FileText,
      roles: ["administrator", "finance", "operations"],
    },
    {
      name: "Drivers",
      href: "/dashboard/drivers",
      icon: Car,
      roles: ["administrator"],
    },
    {
      name: "Trips",
      href: "/dashboard/tours",
      icon: Calendar,
      roles: ["administrator", "operations", "finance"],
    },
    {
      name: "Payments",
      href: "/dashboard/payments",
      icon: DollarSign,
      roles: ["administrator", "finance"],
    },
    {
      name: "Activity Logs",
      href: "/dashboard/logs",
      icon: Shield,
      roles: ["administrator"],
    },
    {
      name: "Reports",
      href: "/dashboard/report",
      icon: ChartArea,
      roles: ["administrator"],
    },
  ];

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(profile?.role || "")
  );

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const NavContent = () => (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {profile?.full_name}
            </p>
            <p className="text-xs capitalize text-gray-500">{profile?.role}</p>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-2">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Button
              key={item.name}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-4 py-6",
                isActive
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-gray-600 hover:bg-slate-50 hover:text-gray-900"
              )}
              onClick={() => {
                router.push(item.href);
                setMobileMenuOpen(false);
              }}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Button>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
        <div className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Powered by{" "}
          <a
            href="https://www.instagram.com/onestop.projects?igsh=amxhd202Zzc3Z24x"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2"
          >
            One Stop
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden w-64 border-r bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b px-6 py-4">
            <Image
              src="/logo.png"
              alt="Glorious Transfer Logo"
              width={200}
              height={100}
            />
          </div>
          <div className="relative flex-1">
            <NavContent />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b bg-white px-4 py-3 lg:px-8">
          <div className="flex items-center justify-between">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-full flex-col">
                  <div className="border-b px-6 py-4">
                    <Image
                      src="/logo.png"
                      alt="Glorious Transfer Logo"
                      width={150}
                      height={100}
                    />
                  </div>
                  <div className="relative flex-1">
                    <NavContent />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div className="hidden lg:block">
              <h2 className="text-lg font-semibold text-gray-900">
                {filteredNav.find((item) => item.href === pathname)?.name ||
                  "Dashboard"}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
