"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Send } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const submitContact = useMutation(api.contacts.submitContactForm);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
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

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitContact({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });
      setIsSubmitted(true);
    } catch (error) {
      setErrors({ submit: "Failed to submit. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12 px-6 bg-card rounded-xl border border-border">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-semibold text-foreground mb-3">
          Message Sent!
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-2">
          Thank you for reaching out. We&apos;ve received your message.
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Expect a response within 1 business day
          </span>{" "}
          (excluding holidays).
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setIsSubmitted(false);
            setFormData(initialFormData);
          }}
        >
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Your name"
            error={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="you@example.com"
            error={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          placeholder="What's this about?"
          error={!!errors.subject}
        />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => updateField("message", e.target.value)}
          placeholder="Your message..."
          className="min-h-[140px]"
          error={!!errors.message}
        />
        {errors.message && (
          <p className="text-sm text-destructive">{errors.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Send Message
          </>
        )}
      </Button>
    </form>
  );
}
