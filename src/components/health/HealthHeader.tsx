"use client";

/**
 * SHARED HEALTH HEADER
 * 
 * Unified navigation for all /health/* pages
 * Matches the existing glassmorphism design from health.css
 * Includes: Services dropdown, For Organizations, About Us, Resource Center, Explore Plans
 * Mobile responsive with hamburger menu
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import IdealHealthWordmark from "./NexusHealthWordmark";
import MemberPortalButton from "@/components/auth/MemberPortalButton";
import styles from "./health-header.module.css";

interface HealthHeaderProps {
  /** Show cart icon with item count */
  cartItemCount?: number;
}

export default function HealthHeader({ cartItemCount = 0 }: HealthHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Drop the Shop link when the storefront is switched off, so the nav never
  // points at a 404. Undefined means still loading: keep the link, because the
  // shop is on in the ordinary case and a link that blinks in on every page
  // load is worse than one that briefly outlives a switch-off.
  const shopEnabled = useQuery(api.shop.queries.isEnabled) !== false;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lock background scroll while the mobile menu is open so the page
  // doesn't slide around behind the menu — a common source of confusion.
  useEffect(() => {
    if (mobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [mobileMenuOpen]);

  // Compute the base path segment so all links work for any brand route
  const basePath = `/${pathname.split('/')[1]}`;

  const resourceCenterHref = isSignedIn ? `${basePath}/dashboard` : `${basePath}/resources`;

  // Determine if Explore Plans should be highlighted
  const isPlansActive = pathname.startsWith(`${basePath}/plans`) ||
                        pathname === `${basePath}/compare` ||
                        pathname === `${basePath}/checkout`;

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  return (
    <>
    {/* Backdrop — sits behind the dropdown; tap anywhere outside to close.
        Rendered as a sibling of <header> because the header's backdrop-filter
        would otherwise trap a position:fixed child inside the header box. */}
    {mobileMenuOpen && (
      <div className={styles.mobileBackdrop} onClick={closeMenu} aria-hidden="true" />
    )}
    <header className="site-header">
      <div className={styles.headerContainer}>
        <IdealHealthWordmark />
        
        {/* Desktop Navigation */}
        <nav className={styles.desktopNav}>
          <ul className="nav-list">
            {/* Services Dropdown */}
            <li className="nav-item nav-item--dropdown">
              <a href="#" className="nav-link nav-link--dropdown">Services</a>
              <div className="dropdown-menu">
                <p className="dropdown-description">Explore our oral health services.</p>
                <ul className="dropdown-list">
                  <li><Link href={`${basePath}/oral-health-scan`}>Oral Health Scan</Link></li>
                  <li><Link href={`${basePath}/teledentistry`}>Teledentistry</Link></li>
                  <li><Link href={`${basePath}/discount`}>Dental Discount Network</Link></li>
                </ul>
              </div>
            </li>

            {/* Shop — deliberately its own item, not under Services. Services
                are plan benefits; the shop is outbound affiliate retail and
                must never read as something a plan includes. */}
            {shopEnabled && (
              <li className="nav-item">
                <Link href={`${basePath}/shop`} className="nav-link">Shop</Link>
              </li>
            )}

            {/* Explore Plans - Primary CTA */}
            <li className="nav-item">
              <Link
                href={`${basePath}/plans`}
                className={`button button--primary ${isPlansActive ? 'button--active' : ''}`}
                style={{ 
                  padding: '10px 22px', 
                  fontSize: '0.9375rem',
                  marginLeft: '12px',
                  fontWeight: '600',
                  background: '#14b8a6',
                  color: 'white',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#14b8a6'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Explore Plans
              </Link>
            </li>
            
            {/* Cart Icon (only show if items in cart, and only on client after mount) */}
            {isMounted && cartItemCount > 0 && (
              <li className="nav-item">
                <Link
                  href={`${basePath}/checkout`}
                  className="nav-link"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '8px'
                  }}
                >
                  <ShoppingCart size={20} />
                  <span 
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '8px',
                      background: 'var(--accent-teal)',
                      color: 'white',
                      fontSize: '0.6875rem',
                      fontWeight: '600',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {cartItemCount}
                  </span>
                </Link>
              </li>
            )}
            
            {/* Member Portal - Always visible on all pages */}
            <li className="nav-item" style={{ marginLeft: '8px' }}>
              <MemberPortalButton />
            </li>
          </ul>
        </nav>

        {/* Mobile Menu Button — labeled so it clearly reads as a tappable menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={styles.mobileMenuButton}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          <span className={styles.mobileMenuButtonLabel}>{mobileMenuOpen ? "Close" : "Menu"}</span>
        </button>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
          <div className={styles.mobileMenuContent}>
              {/* Primary action — Enroll Now goes straight to checkout */}
              <div className={styles.mobileMenuSection}>
                <Link
                  href={`${basePath}/checkout?plan=individual`}
                  onClick={closeMenu}
                  className="button button--accent"
                  style={{
                    display: "block",
                    textAlign: "center",
                    width: "100%",
                    padding: "0.9rem 1rem",
                    fontSize: "1.0625rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Enroll Now
                </Link>
              </div>

              {/* Services Mobile Dropdown */}
              <div className={styles.mobileMenuSection}>
                <button
                  onClick={() => toggleDropdown('services')}
                  className={styles.mobileMenuToggle}
                >
                  Services
                  <span style={{ fontSize: "0.75rem" }}>{openDropdown === 'services' ? '−' : '+'}</span>
                </button>
                <div className={`${styles.mobileMenuDropdown} ${openDropdown === 'services' ? styles.open : ''}`}>
                  <div>
                    <Link href={`${basePath}/oral-health-scan`} onClick={closeMenu} className={styles.mobileMenuLink}>
                      Oral Health Scan
                    </Link>
                    <Link href={`${basePath}/teledentistry`} onClick={closeMenu} className={styles.mobileMenuLink}>
                      Teledentistry
                    </Link>
                    <Link href={`${basePath}/discount`} onClick={closeMenu} className={styles.mobileMenuLink}>
                      Dental Discount Network
                    </Link>
                  </div>
                </div>
              </div>

              {/* Shop — outside the Services group on purpose (see desktop nav) */}
              {shopEnabled && (
                <Link href={`${basePath}/shop`} onClick={closeMenu} className={styles.mobileMenuLink}>
                  Shop
                </Link>
              )}

              {/* For Organizations Mobile */}

              {/* About Us Mobile */}

              {/* Resource Center */}

              {/* Explore Plans CTA */}
              <div className={styles.mobileMenuSection} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <Link
                  href={`${basePath}/plans`}
                  onClick={closeMenu}
                  className="button button--primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    width: "100%",
                    padding: "0.75rem 1rem",
                    textDecoration: "none"
                  }}
                >
                  Explore Plans
                </Link>
              </div>

              {/* Member Portal (Mobile) - Always visible */}
              <div className={styles.mobileMenuSection} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <Link
                  href={isSignedIn ? `${basePath}/dashboard` : `${basePath}/sign-in`}
                  onClick={closeMenu}
                  className={styles.mobileMenuToggle}
                  style={{ color: "#14b8a6", fontWeight: "600", textDecoration: "none" }}
                >
                  {isSignedIn ? "My Dashboard" : "Member Portal"}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
    </>
  );
}
