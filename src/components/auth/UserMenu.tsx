"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Settings, User } from "lucide-react";

/**
 * Custom user menu that replaces Clerk's UserButton
 * Shows user info and logout option
 */
export default function UserMenu() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    router.push("/health");
  };

  if (!user) return null;

  const initials = (user.firstName?.charAt(0) || "") + (user.lastName?.charAt(0) || "");
  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.primaryEmailAddress?.emailAddress || "User";
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  const navigate = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors"
        title={displayName}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
          style={{ backgroundColor: "#0066CC" }}
        >
          {initials || <User size={14} />}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-800 max-w-[120px] truncate">
          {displayName.split(" ")[0]}
        </span>
        <ChevronDown
          size={14}
          className="text-gray-400 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 z-50 overflow-hidden"
          style={{ boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)" }}
          role="menu"
        >
          {/* User Info Header */}
          <div className="flex items-center gap-3 px-4 py-4 bg-gray-50 border-b border-gray-100">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: "#0066CC" }}
            >
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={() => navigate("/health/dashboard")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutDashboard size={16} className="text-gray-400 shrink-0" />
              Member Portal
            </button>

            <button
              role="menuitem"
              onClick={() => navigate("/health/manage-plans")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} className="text-gray-400 shrink-0" />
              Manage Plans
            </button>
          </div>

          {/* Log Out */}
          <div className="border-t border-gray-100 py-1.5">
            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} className="shrink-0" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
