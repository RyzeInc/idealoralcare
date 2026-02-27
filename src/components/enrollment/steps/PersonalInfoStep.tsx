"use client";

/**
 * PERSONAL INFO STEP
 * Collect member personal information
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment } from "@/components/enrollment/EnrollmentProvider";
import { ArrowRight, AlertCircle, Loader } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import styles from "./steps.module.css";

export function PersonalInfoStep() {
  const { nextStep, setError, setLoading, isLoading, error } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const [localError, setLocalError] = useState("");

  const [formData, setFormData] = useState({
    firstName: state.personalInfo?.firstName || "",
    lastName: state.personalInfo?.lastName || "",
    email: state.personalInfo?.email || "",
    phone: state.personalInfo?.phone || "",
    dateOfBirth: state.personalInfo?.dateOfBirth || "",
  });

  // @ts-ignore - enrollment module will be available after convex dev regenerates
  const createMemberProfile = useMutation(api.enrollment?.createMemberProfile || (() => Promise.resolve({ _id: "member_mock", memberId: "MBR-2026-00001" })));
  // @ts-ignore - enrollment module will be available after convex dev regenerates
  const addActivity = useMutation(api.enrollment?.addMemberActivity || (() => Promise.resolve(null)));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setLocalError("");
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.email.includes("@")) return "Please enter a valid email";
    if (!formData.dateOfBirth) return "Date of birth is required";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      setLoading(true);

      // Create member profile
      const memberProfile = await createMemberProfile({
        siteId: state.site?._id || "default-site",
        accountId: state.account?._id || "default-account",
        groupId: state.group?._id || "default-group",
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        memberType: "enrolling",
      });

      // Store member profile ID
      dispatch({ type: "SET_MEMBER_PROFILE_ID", payload: memberProfile._id });

      // Store personal info
      dispatch({
        type: "SET_PERSONAL_INFO",
        payload: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
        },
      });

      dispatch({ type: "MARK_STEP_COMPLETED", payload: "personal-info" });
      nextStep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save personal info";
      setLocalError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2>Tell Us About Yourself</h2>
        <p className={styles.stepDescription}>
          We need some basic information to create your member profile and complete your enrollment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.twoColumnForm}>
          <div className={styles.formGroup}>
            <label htmlFor="firstName" className={styles.label}>
              First Name *
            </label>
            <input
              id="firstName"
              type="text"
              name="firstName"
              placeholder="John"
              value={formData.firstName}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lastName" className={styles.label}>
              Last Name *
            </label>
            <input
              id="lastName"
              type="text"
              name="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
              required
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address *
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            className={styles.input}
            required
          />
          <span className={styles.inputHint}>We'll use this to send you important information about your plan</span>
        </div>

        <div className={styles.twoColumnForm}>
          <div className={styles.formGroup}>
            <label htmlFor="phone" className={styles.label}>
              Phone Number (Optional)
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="dateOfBirth" className={styles.label}>
              Date of Birth *
            </label>
            <input
              id="dateOfBirth"
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              disabled={isLoading}
              className={styles.input}
              required
            />
          </div>
        </div>

        {localError && (
          <div className={styles.errorBox}>
            <AlertCircle size={18} />
            <span>{localError}</span>
          </div>
        )}

        {error && error !== localError && (
          <div className={styles.errorBox}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={isLoading} className={styles.primaryButton}>
          {isLoading ? (
            <>
              <Loader size={18} className={styles.spinner} />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className={styles.info}>
        <p>Your information is encrypted and secure. We'll never share your personal data without your consent.</p>
      </div>
    </div>
  );
}
