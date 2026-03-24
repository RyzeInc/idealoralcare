'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { Plus, Pencil, Trash2, Loader2, Phone, Mail } from 'lucide-react';
import { UserSelector } from './UserSelector';
import styles from './BrokersAdmin.module.css';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
}

export function BrokersAdmin() {
  const [showForm, setShowForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Doc<'adminUsers'> | null>(null);
  const [useExistingUser, setUseExistingUser] = useState(true);
  const [selectedClerkUser, setSelectedClerkUser] = useState<ClerkUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    commissionRate: '',
    clerkUserId: '',
  });

  // Fetch all admin users (we'll filter to brokers)
  const allAdmins = useQuery(api.admin.adminUsers.getAll);
  const brokers = (allAdmins ?? []).filter((admin) =>
    (admin.departments ?? []).includes('broker')
  );

  // Mutations
  const addAdminMutation = useMutation(api.admin.adminUsers.add);
  const updateAdminMutation = useMutation(api.admin.adminUsers.updateAdmin);
  const deleteAdminMutation = useMutation(api.admin.adminUsers.remove);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      commissionRate: '',
      clerkUserId: '',
    });
    setSelectedClerkUser(null);
    setEditingBroker(null);
    setShowForm(false);
  };

  const handleSelectClerkUser = (user: ClerkUser) => {
    setSelectedClerkUser(user);
    setFormData({
      ...formData,
      name: user.name,
      email: user.email,
      clerkUserId: user.id,
    });
  };

  const handleEditBroker = (broker: Doc<'adminUsers'>) => {
    setEditingBroker(broker);
    setFormData({
      name: broker.name,
      email: broker.email,
      phone: broker.phone || '',
      commissionRate: broker.commissionRate?.toString() || '',
      clerkUserId: broker.clerkUserId,
    });
    setShowForm(true);
  };

  const handleSaveBroker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      alert('Please fill in name and email');
      return;
    }

    if (!formData.clerkUserId) {
      alert('Please select or provide a Clerk User ID');
      return;
    }

    try {
      if (editingBroker) {
        // Update existing
        await updateAdminMutation({
          id: editingBroker._id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          departments: editingBroker.departments,
          commissionRate: formData.commissionRate
            ? parseFloat(formData.commissionRate)
            : undefined,
        });
      } else {
        // Add new - validate clerkUserId
        const existingBroker = (allAdmins ?? []).find(
          (admin) => admin.clerkUserId === formData.clerkUserId
        );
        if (existingBroker) {
          alert('A broker with this Clerk ID already exists');
          return;
        }

        await addAdminMutation({
          clerkUserId: formData.clerkUserId,
          email: formData.email,
          name: formData.name,
          phone: formData.phone || undefined,
          role: 'editor',
          departments: ['broker'],
          commissionRate: formData.commissionRate
            ? parseFloat(formData.commissionRate)
            : undefined,
        });
      }

      resetForm();
    } catch (error) {
      alert('Error saving broker. Please try again.');
    }
  };

  const handleDeleteBroker = async (broker: Doc<'adminUsers'>) => {
    if (
      !confirm(
        `Are you sure you want to delete broker "${broker.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteAdminMutation({ id: broker._id });
    } catch (error) {
      alert('Error deleting broker. Please try again.');
    }
  };

  if (allAdmins === undefined) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Loading brokers...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Broker Management</h1>
        <p>Add and manage brokers who can enroll members</p>
        <button
          onClick={() => (editingBroker ? resetForm() : setShowForm(!showForm))}
          className={styles.addButton}
        >
          <Plus size={18} />
          {showForm && !editingBroker ? 'Cancel' : 'Add Broker'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingBroker ? 'Edit Broker' : 'Add New Broker'}</h2>
          <form onSubmit={handleSaveBroker}>
            {!editingBroker && (
              <div className={styles.modeToggle}>
                <label className={styles.modeLabel}>How would you like to add this broker?</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={useExistingUser}
                      onChange={() => {
                        setUseExistingUser(true);
                        setSelectedClerkUser(null);
                        setFormData({
                          name: '',
                          email: '',
                          phone: '',
                          commissionRate: '',
                          clerkUserId: '',
                        });
                      }}
                    />
                    <span>Select from Existing Users</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={!useExistingUser}
                      onChange={() => {
                        setUseExistingUser(false);
                        setSelectedClerkUser(null);
                        setFormData({
                          name: '',
                          email: '',
                          phone: '',
                          commissionRate: '',
                          clerkUserId: '',
                        });
                      }}
                    />
                    <span>Manual Entry</span>
                  </label>
                </div>
              </div>
            )}

            {!editingBroker && useExistingUser && (
              <div className={styles.formGroup}>
                <UserSelector
                  onSelectUser={handleSelectClerkUser}
                  selectedUserId={formData.clerkUserId}
                  label="Select an Existing User"
                  placeholder="Search by name or email..."
                  excludeUserIds={(allAdmins ?? [])
                    .filter((a) => (a.departments ?? []).includes('broker'))
                    .map((a) => a.clerkUserId)}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
                disabled={selectedClerkUser !== null}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
                required
                disabled={selectedClerkUser !== null}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="(555) 123-4567"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Commission Rate (%)</label>
              <input
                type="number"
                value={formData.commissionRate}
                onChange={(e) =>
                  setFormData({ ...formData, commissionRate: e.target.value })
                }
                placeholder="10.5"
                step="0.1"
                min="0"
              />
            </div>

            {!editingBroker && !useExistingUser && (
              <div className={styles.formGroup}>
                <label>Clerk User ID *</label>
                <input
                  type="text"
                  value={formData.clerkUserId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      clerkUserId: e.target.value,
                    })
                  }
                  placeholder="user_xxxxxxxxxxxxx"
                  required
                />
                <p className={styles.hint}>
                  Get this from Clerk when the user signs up or from the Clerk
                  Dashboard
                </p>
              </div>
            )}

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton}>
                {editingBroker ? 'Update Broker' : 'Add Broker'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Brokers List */}
      <div className={styles.content}>
        {brokers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>You haven't added any brokers yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className={styles.emptyAddButton}
            >
              <Plus size={18} />
              Add Your First Broker
            </button>
          </div>
        ) : (
          <div className={styles.brokerGrid}>
            {brokers.map((broker) => (
              <div key={broker._id} className={styles.brokerCard}>
                <div className={styles.brokerHeader}>
                  <h3>{broker.name}</h3>
                  <div className={styles.brokerActions}>
                    <button
                      onClick={() => handleEditBroker(broker)}
                      className={styles.editButton}
                      title="Edit broker"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteBroker(broker)}
                      className={styles.deleteButton}
                      title="Delete broker"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className={styles.brokerInfo}>
                  <div className={styles.infoRow}>
                    <Mail size={16} />
                    <a href={`mailto:${broker.email}`}>{broker.email}</a>
                  </div>

                  {broker.phone && (
                    <div className={styles.infoRow}>
                      <Phone size={16} />
                      <a href={`tel:${broker.phone}`}>{broker.phone}</a>
                    </div>
                  )}

                  {broker.commissionRate && (
                    <div className={styles.infoRow}>
                      <span>Commission Rate:</span>
                      <strong>{broker.commissionRate}%</strong>
                    </div>
                  )}
                </div>

                <div className={styles.brokerFooter}>
                  <span className={styles.department}>Broker</span>
                  <span className={styles.clerkId}>
                    {broker.clerkUserId.substring(0, 20)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
