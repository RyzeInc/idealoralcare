'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Loader2 } from 'lucide-react';
import styles from './UserSelector.module.css';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl?: string;
}

interface UserSelectorProps {
  onSelectUser: (user: ClerkUser) => void;
  selectedUserId?: string;
  label?: string;
  placeholder?: string;
  excludeUserIds?: string[];
}

export function UserSelector({
  onSelectUser,
  selectedUserId,
  label = 'Select a Clerk User',
  placeholder = 'Search by name or email...',
  excludeUserIds = [],
}: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ClerkUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen && !searchQuery) return;

      setLoading(true);
      setError(null);

      try {
        const url = new URL('/api/clerk/users', window.location.origin);
        if (searchQuery) {
          url.searchParams.set('search', searchQuery);
        }
        url.searchParams.set('limit', '100');

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        const filtered = data.users.filter(
          (user: ClerkUser) => !excludeUserIds.includes(user.id)
        );
        setUsers(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching users');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [isOpen, searchQuery, excludeUserIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectUser = (user: ClerkUser) => {
    setSearchQuery('');
    setIsOpen(false);
    onSelectUser(user);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <label className={styles.label}>{label}</label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.trigger}
      >
        {selectedUser ? (
          <div className={styles.selectedUser}>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{selectedUser.name}</div>
              <div className={styles.userEmail}>{selectedUser.email}</div>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>Select a user...</div>
        )}
        <ChevronDown
          size={18}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
          </div>

          <div className={styles.userList}>
            {loading && (
              <div className={styles.loadingState}>
                <Loader2 size={18} className={styles.spinner} />
                <span>Loading users...</span>
              </div>
            )}

            {error && (
              <div className={styles.errorState}>
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <div className={styles.emptyState}>
                {searchQuery
                  ? 'No users found matching your search'
                  : 'No users available'}
              </div>
            )}

            {!loading &&
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className={`${styles.userItem} ${
                    selectedUserId === user.id ? styles.selected : ''
                  }`}
                >
                  <div className={styles.userItemInfo}>
                    <div className={styles.userItemName}>{user.name}</div>
                    <div className={styles.userItemEmail}>{user.email}</div>
                  </div>
                  {selectedUserId === user.id && (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="currentColor"
                      className={styles.checkmark}
                    >
                      <path d="M16.707 4.293a1 1 0 010 1.414l-9 9a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L7 12.586l8.293-8.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
