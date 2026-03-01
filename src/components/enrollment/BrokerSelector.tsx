'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import styles from './BrokerSelector.module.css';

interface BrokerSelectorProps {
  onSelectBroker: (broker: Doc<'adminUsers'>) => void;
  onSkip?: () => void;
  flowType: string;
}

export function BrokerSelector({
  onSelectBroker,
  onSkip,
  flowType,
}: BrokerSelectorProps) {
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch brokers (adminUsers with "broker" department)
  const brokers = useQuery(api.admin.adminUsers.getBrokersByDepartment) || [];

  const filteredBrokers = brokers.filter(
    (broker) =>
      (broker.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (broker.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (brokerId: string) => {
    setSelectedBrokerId(brokerId);
  };

  const handleConfirm = () => {
    const selectedBroker = brokers.find((b) => b._id.toString() === selectedBrokerId);
    if (selectedBroker) {
      onSelectBroker(selectedBroker);
    }
  };

  if (brokers === undefined) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={32} className={styles.spinner} />
          <p>Loading brokers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerBadge}>Step 1 of Enrollment</div>
          <h1>Select Your Broker</h1>
          <p>Choose the broker or agent handling your enrollment</p>
        </div>

        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {filteredBrokers.length > 0 && (
            <div className={styles.searchHint}>
              {filteredBrokers.length} broker{filteredBrokers.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        {filteredBrokers.length === 0 ? (
          <div className={styles.emptyState}>
            {brokers.length === 0 ? (
              <>
                <p>No brokers available yet.</p>
                <p className={styles.emptyHint}>Contact your administrator to add brokers.</p>
              </>
            ) : (
              <>
                <p>No brokers found matching your search.</p>
                <p className={styles.emptyHint}>Try a different search term or clear the filter.</p>
              </>
            )}
          </div>
        ) : (
          <div className={styles.brokerGrid}>
            {filteredBrokers.map((broker) => (
              <div
                key={broker._id}
                className={`${styles.brokerCard} ${
                  selectedBrokerId === broker._id.toString()
                    ? styles.selected
                    : ''
                }`}
                onClick={() => handleSelect(broker._id.toString())}
              >
                <div className={styles.brokerCardInner}>
                  <div className={styles.brokerInfo}>
                    <h3>{broker.name}</h3>
                    <p className={styles.email}>{broker.email}</p>
                    {broker.phone && (
                      <p className={styles.phone}>{broker.phone}</p>
                    )}
                  </div>
                  <div className={styles.checkbox}>
                    {selectedBrokerId === broker._id.toString() && (
                      <CheckCircle2 size={24} className={styles.checkIcon} />
                    )}
                  </div>
                </div>
                {selectedBrokerId === broker._id.toString() && (
                  <div className={styles.selectedBadge}>Selected</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          {onSkip && (
            <button onClick={onSkip} className={styles.skipButton}>
              Skip & Continue Enrollment
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedBrokerId}
            className={styles.confirmButton}
          >
            {selectedBrokerId ? (
              <>
                Continue with Broker
                <ArrowRight size={18} />
              </>
            ) : (
              'Select a broker to continue'
            )}
          </button>
        </div>

        {selectedBrokerId && (
          <div className={styles.confirmationMessage}>
            <CheckCircle2 size={16} />
            You've selected a broker. They'll receive credit for this enrollment.
          </div>
        )}
      </div>
    </div>
  );
}
