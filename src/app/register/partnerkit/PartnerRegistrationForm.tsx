"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  phone: string;
  business: string;
  wantsPartnerKit: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  name: "",
  email: "",
  phone: "",
  business: "",
  wantsPartnerKit: false,
};

export function PartnerRegistrationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitRegistration = useMutation(api.contacts.submitPartnerRegistration);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\+?[\d\s\-().]{7,}$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (!formData.business.trim()) {
      newErrors.business = "Business name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitRegistration({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        business: formData.business.trim(),
        wantsPartnerKit: formData.wantsPartnerKit,
      });
      setIsSubmitted(true);
      // Give the user a moment to read the confirmation, then redirect to /health.
      setTimeout(() => router.push("/health"), 3500);
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-semibold text-[#0F1320] mb-3">
          You&apos;re all set!
        </h3>
        <p className="text-[#64748B] max-w-sm mx-auto mb-2">
          Thanks{formData.name ? `, ${formData.name.split(" ")[0]}` : ""}. We&apos;ve
          received your registration
          {formData.wantsPartnerKit
            ? " and will send your partner kit shortly."
            : " and our team will be in touch soon."}
        </p>
        <p className="text-sm text-[#94A3B8] flex items-center justify-center gap-2 mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Taking you to the plan details…
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push("/health")}
        >
          Go now
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Jane Smith"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          autoComplete="name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@youragency.com"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          autoComplete="email"
          disabled={isSubmitting}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="(555) 000-0000"
          value={formData.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          autoComplete="tel"
          disabled={isSubmitting}
        />
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone}</p>
        )}
      </div>

      {/* Business */}
      <div className="space-y-1.5">
        <Label htmlFor="business">Business / Agency Name</Label>
        <Input
          id="business"
          type="text"
          placeholder="Your Agency LLC"
          value={formData.business}
          onChange={(e) => updateField("business", e.target.value)}
          autoComplete="organization"
          disabled={isSubmitting}
        />
        {errors.business && (
          <p className="text-xs text-red-500">{errors.business}</p>
        )}
      </div>

      {/* Partner Kit Checkbox */}
      <div className="flex items-start gap-3 rounded-xl border border-[#E8E3DF] bg-[#F6F4F1] p-4">
        <Checkbox
          id="partner-kit"
          checked={formData.wantsPartnerKit}
          onCheckedChange={(checked) => updateField("wantsPartnerKit", checked)}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        <label
          htmlFor="partner-kit"
          className="text-sm text-[#354158] leading-snug cursor-pointer select-none"
        >
          <span className="font-medium">Send me the Partner Kit</span>
          <span className="block text-[#64748B] mt-0.5">
            Receive our partner overview, compensation structure, and onboarding
            materials via email.
          </span>
        </label>
      </div>

      {/* Submit error */}
      {errors.submit && (
        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Get Started"
        )}
      </Button>

      <p className="text-xs text-center text-[#94A3B8]">
        By submitting, you agree to be contacted by the Ideal Oral Health
        partnership team.
      </p>

      <p className="text-xs text-center text-[#64748B] leading-relaxed">
        Your information stays with us. We do <span className="font-medium">not</span> sell,
        rent, or share your details with anyone outside of Ryze Ideal.
      </p>
    </form>
  );
}
