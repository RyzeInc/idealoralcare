"use client";

/**
 * CATALOG HEADER
 * 
 * Navigation header for health plans catalog flow
 * Links: Home, How It Works, Plans, Dashboard (if logged in)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ShoppingCart, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/health-plans";
import styles from "./catalogHeader.module.css";

export function CatalogHeader() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/health", label: "Home" },
    { href: "/health/how-it-works", label: "How It Works" },
    { href: "/health/plans", label: "Browse Plans" },
  ];

  const isActive = (href: string) => {
    if (href === "/health") return pathname === "/health";
    return pathname.startsWith(href);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        {/* Logo */}
        <Link href="/health" className={styles.logo}>
          <span className={styles.logoText}>Nexus</span>
          <span className={styles.logoAccent}>Health</span>
        </Link>

        {/* Desktop Nav */}
        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Cart indicator */}
          {itemCount > 0 && (
            <Link href="/health/checkout" className={styles.cartButton}>
              <ShoppingCart size={20} />
              <span className={styles.cartBadge}>{itemCount}</span>
            </Link>
          )}

          {/* Account */}
          {isSignedIn ? (
            <Link href="/health/dashboard" className={styles.accountButton}>
              <User size={20} />
              <span className={styles.accountText}>Dashboard</span>
            </Link>
          ) : (
            <Link href="/sign-in" className={styles.signInButton}>
              Sign In
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className={styles.mobileMenuToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.mobileNavLink} ${isActive(link.href) ? styles.mobileNavLinkActive : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isSignedIn ? (
            <Link
              href="/health/dashboard"
              className={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              My Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className={styles.mobileNavLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
