"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Menu, X, CreditCard, History, LogOut, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = session
    ? [
        { name: "Buy Credits", href: "/buy-credits", icon: CreditCard },
        { name: "Transactions", href: "/user-transactions", icon: History },
      ]
    : [];

  return (
    <nav className="bg-background border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold">
                Lookup Engine
              </Link>
            </div>

            {/* Desktop Navigation */}
            {session && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4 sm:items-center">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.name}
                      asChild
                      variant="ghost"
                      className="gap-2"
                    >
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right side menu */}
          <div className="flex items-center">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm hidden sm:block">
                  Welcome, {session.user?.username || "User"}
                </span>
                <Button
                  variant="outline"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="hidden sm:flex gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>

                {/* Mobile menu button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/login">
                    <User className="h-4 w-4" />
                    Login
                  </Link>
                </Button>
                <Button asChild className="gap-2">
                  <Link href="/register">
                    <User className="h-4 w-4" />
                    Register
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={cn("sm:hidden", mobileMenuOpen ? "block" : "hidden")}>
        <div className="px-2 pt-2 pb-3 space-y-1 border-t">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.name}
                asChild
                variant="ghost"
                className="w-full justify-start gap-2"
              >
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full justify-start gap-2 text-red-500 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
