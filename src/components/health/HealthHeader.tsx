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
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
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

  const resourceCenterHref = isSignedIn ? "/health/dashboard" : "/health/resources";

  // Determine if Explore Plans should be highlighted
  const isPlansActive = pathname.startsWith("/health/plans") || 
                        pathname === "/health/compare" || 
                        pathname === "/health/checkout";

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  return (
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
                  <li><Link href="/health/oral-health-scan">Oral Health Scan</Link></li>
                  <li><Link href="/health/teledentistry">Teledentistry</Link></li>
                  <li><Link href="/health/discount">Dental Discount Network</Link></li>
                </ul>
              </div>
            </li>
            
            {/* For Organizations Dropdown */}
            <li className="nav-item nav-item--dropdown">
              <a href="#" className="nav-link nav-link--dropdown">For Organizations</a>
              <div className="dropdown-menu">
                <p className="dropdown-description">Empower your team with better health plans.</p>
                <ul className="dropdown-list">
                  <li><Link href="/organizations/dental">Oral Health Plans</Link></li>
                  <li><Link href="/organizations/medicaid">Medicaid / CHIP</Link></li>
                  <li><Link href="/organizations/brokers">Benefits Brokers</Link></li>
                  <li><Link href="/organizations/employers">Employers</Link></li>
                  <li><Link href="/organizations/dso">DSO</Link></li>
                </ul>
              </div>
            </li>
            
            {/* About Us Dropdown */}
            <li className="nav-item nav-item--dropdown">
              <a href="#" className="nav-link nav-link--dropdown">About Us</a>
              <div className="dropdown-menu">
                <p className="dropdown-description">Learn more about Ideal Health by Ideal.</p>
                <ul className="dropdown-list">
                  <li><Link href="/about/mission">Our Mission & Vision</Link></li>
                  <li><Link href="/about/team">Our Team</Link></li>
                  <li><Link href="/about/providers">For Providers</Link></li>
                  <li><Link href="/about/newsroom">Newsroom</Link></li>
                  <li><Link href="/contact">Contact Us</Link></li>
                </ul>
              </div>
            </li>
            
            {/* Resource Center */}
            <li className="nav-item">
              <Link href={resourceCenterHref} className="nav-link">Resource Center</Link>
            </li>
            
            {/* Explore Plans - Primary CTA */}
            <li className="nav-item">
              <Link 
                href="/health/plans" 
                className={`button button--primary ${isPlansActive ? 'button--active' : ''}`}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '0.875rem',
                  marginLeft: '8px'
                }}
              >
                Explore Plans
              </Link>
            </li>
            
            {/* Cart Icon (only show if items in cart) */}
            {cartItemCount > 0 && (
              <li className="nav-item">
                <Link 
                  href="/health/checkout" 
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={styles.mobileMenuButton}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
          <div className={styles.mobileMenuContent}>
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
                    <Link href="/health/oral-health-scan" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Oral Health Scan
                    </Link>
                    <Link href="/health/teledentistry" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Teledentistry
                    </Link>
                    <Link href="/health/discount" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Dental Discount Network
                    </Link>
                  </div>
                </div>
              </div>

              {/* For Organizations Mobile */}
              <div className={styles.mobileMenuSection}>
                <button
                  onClick={() => toggleDropdown('organizations')}
                  className={styles.mobileMenuToggle}
                >
                  For Organizations
                  <span style={{ fontSize: "0.75rem" }}>{openDropdown === 'organizations' ? '−' : '+'}</span>
                </button>
                <div className={`${styles.mobileMenuDropdown} ${openDropdown === 'organizations' ? styles.open : ''}`}>
                  <div>
                    <Link href="/organizations/dental" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Oral Health Plans
                    </Link>
                    <Link href="/organizations/medicaid" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Medicaid / CHIP
                    </Link>
                    <Link href="/organizations/brokers" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Benefits Brokers
                    </Link>
                    <Link href="/organizations/employers" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Employers
                    </Link>
                    <Link href="/organizations/dso" onClick={closeMenu} className={styles.mobileMenuLink}>
                      DSO
                    </Link>
                  </div>
                </div>
              </div>

              {/* About Us Mobile */}
              <div className={styles.mobileMenuSection}>
                <button
                  onClick={() => toggleDropdown('about')}
                  className={styles.mobileMenuToggle}
                >
                  About Us
                  <span style={{ fontSize: "0.75rem" }}>{openDropdown === 'about' ? '−' : '+'}</span>
                </button>
                <div className={`${styles.mobileMenuDropdown} ${openDropdown === 'about' ? styles.open : ''}`}>
                  <div>
                    <Link href="/about/mission" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Our Mission & Vision
                    </Link>
                    <Link href="/about/team" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Our Team
                    </Link>
                    <Link href="/about/providers" onClick={closeMenu} className={styles.mobileMenuLink}>
                      For Providers
                    </Link>
                    <Link href="/about/newsroom" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Newsroom
                    </Link>
                    <Link href="/contact" onClick={closeMenu} className={styles.mobileMenuLink}>
                      Contact Us
                    </Link>
                  </div>
                </div>
              </div>

              {/* Resource Center */}
              <div className={styles.mobileMenuSection}>
                <Link 
                  href={resourceCenterHref} 
                  onClick={closeMenu}
                  className={styles.mobileMenuToggle}
                  style={{ textDecoration: "none" }}
                >
                  Resource Center
                </Link>
              </div>

              {/* Explore Plans CTA */}
              <div className={styles.mobileMenuSection} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <Link
                  href="/health/plans"
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
                <MemberPortalButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
