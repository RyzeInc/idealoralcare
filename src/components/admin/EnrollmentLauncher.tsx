'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { X, Loader2 } from 'lucide-react';
import styles from './EnrollmentLauncher.module.css';

type FlowType = 'individual' | 'group_member' | 'group_employer';

interface EnrollmentLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  siteId?: string;
  accountId?: string;
  groupId?: string;
}

export function EnrollmentLauncher({
  isOpen,
  onClose,
  siteId,
  accountId,
  groupId,
}: EnrollmentLauncherProps) {
  const router = useRouter();
  const { user } = useUser();
  const [flowType, setFlowType] = useState<FlowType>('individual');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLeadMutation = useMutation(api.enrollment.members.createLeadFromAdmin);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      if (!siteId || !accountId || !groupId) {
        throw new Error('Missing required context: siteId, accountId, or groupId');
      }

      // Validate form
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
        throw new Error('Please fill in all required fields');
      }

      // Create lead
      const result = await createLeadMutation({
        siteId,
        accountId,
        groupId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        assignedStaffClerkId: user.id,
        assignedStaffName: user.firstName || user.id,
        enrollmentType: flowType === 'individual' ? 'individual' : flowType === 'group_member' ? 'group_member' : 'group_employer',
      });

      if (!result?.memberId) {
        throw new Error('Failed to create lead');
      }

      // Map flow type to enrollment flow param
      const enrollmentFlow =
        flowType === 'individual'
          ? 'broker-individual'
          : flowType === 'group_member'
          ? 'broker-group-member'
          : 'broker-group-employer';

      // Redirect to enrollment with lead and broker pre-filled
      const params = new URLSearchParams({
        flow: enrollmentFlow,
        broker: user.id,
        lead: result.memberId,
      });

      router.push(`/health/enroll?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error creating lead:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Don't render if user data isn't loaded yet
  if (!user) {
    return (
      <>
        {isOpen && <div className={styles.overlay} onClick={onClose} />}
        <div className={styles.drawer}>
          <div className={styles.header}>
            <h2 className={styles.title}>Enroll New Member</h2>
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              <X size={24} />
            </button>
          </div>
          <div className={styles.content} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <Loader2 size={24} className={styles.spinnerIcon} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onClose} />

      {/* Drawer */}
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Enroll New Member</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          {/* Agent Info */}
          {user && (
            <div className={styles.agentInfo}>
              <p className={styles.agentLabel}>Enrolling as:</p>
              <p className={styles.agentName}>{user.firstName || user.id}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Flow Type Selector */}
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Enrollment Type</label>
              <div className={styles.flowOptions}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    value="individual"
                    checked={flowType === 'individual'}
                    onChange={(e) => setFlowType(e.target.value as FlowType)}
                    disabled={loading}
                  />
                  <span>Individual</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    value="group_member"
                    checked={flowType === 'group_member'}
                    onChange={(e) => setFlowType(e.target.value as FlowType)}
                    disabled={loading}
                  />
                  <span>Group (Member Pays)</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    value="group_employer"
                    checked={flowType === 'group_employer'}
                    onChange={(e) => setFlowType(e.target.value as FlowType)}
                    disabled={loading}
                  />
                  <span>Group (Employer Pays)</span>
                </label>
              </div>
            </div>

            {/* Contact Information */}
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Client Information</label>

              <div className={styles.formGroup}>
                <label htmlFor="firstName" className={styles.label}>
                  First Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                  required
                  placeholder="John"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="lastName" className={styles.label}>
                  Last Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                  required
                  placeholder="Smith"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email <span className={styles.required}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                  required
                  placeholder="john@example.com"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="phone" className={styles.label}>
                  Phone <span className={styles.required}>*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                  required
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className={styles.footer}>
              <button
                type="button"
                onClick={onClose}
                className={styles.secondaryButton}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className={styles.spinnerIcon} />
                    Creating...
                  </>
                ) : (
                  'Create Client & Continue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
