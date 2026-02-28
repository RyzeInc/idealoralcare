"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings } from "lucide-react";

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

  const handleLogout = async () => {
    await signOut();
    router.push("/health");
  };

  if (!user) return null;

  const initials = (user.firstName?.charAt(0) || "") + (user.lastName?.charAt(0) || "");
  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.primaryEmailAddress?.emailAddress || "User";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        title={displayName}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: "#0066CC" }}
        >
          {initials || "?"}
        </div>
        <span className="text-sm font-medium text-gray-700">{displayName.split(" ")[0]}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          style={{
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                router.push("/health/dashboard");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User size={16} />
              My Account
            </button>

            <button
              onClick={() => {
                router.push("/health/dashboard");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} />
              Settings
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 py-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
