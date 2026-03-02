"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InquiryType = "partnership" | "investment" | "careers" | "other" | "";

interface FormData {
  // Common fields
  name: string;
  email: string;
  phone: string;
  inquiryType: InquiryType;
  // Partnership fields
  companyName: string;
  industry: string;
  partnershipDescription: string;
  timeline: string;
  // Investment fields
  investmentType: string;
  amountRange: string;
  investmentDescription: string;
  // Careers fields
  positionInterest: string;
  resumePlaceholder: string;
  careerIntro: string;
  // Other
  otherMessage: string;
}

interface FormErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  name: "",
  email: "",
  phone: "",
  inquiryType: "",
  companyName: "",
  industry: "",
  partnershipDescription: "",
  timeline: "",
  investmentType: "",
  amountRange: "",
  investmentDescription: "",
  positionInterest: "",
  resumePlaceholder: "",
  careerIntro: "",
  otherMessage: "",
};

const inquiryTypes = [
  { value: "partnership", label: "Licensing / Partnership" },
  { value: "investment", label: "Investment" },
  { value: "careers", label: "Careers" },
  { value: "other", label: "Other" },
];

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "E-commerce",
  "Consumer Goods",
  "Real Estate",
  "Education",
  "Manufacturing",
  "Other",
];

const timelines = [
  "Immediate (0-3 months)",
  "Short-term (3-6 months)",
  "Medium-term (6-12 months)",
  "Long-term (12+ months)",
  "Flexible",
];

const investmentTypes = [
  "Equity Investment",
  "Debt Financing",
  "Revenue Share",
  "Strategic Partnership",
  "Other",
];

const amountRanges = [
  "Under $100K",
  "$100K - $500K",
  "$500K - $1M",
  "$1M - $5M",
  "$5M+",
  "Flexible / To Be Discussed",
];

const positions = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Operations",
  "Finance",
  "Sales",
  "Other",
];

interface SmartInquiryFormProps {
  preselectedType?: InquiryType;
}

export function SmartInquiryForm({ preselectedType }: SmartInquiryFormProps) {
  const [step, setStep] = useState(preselectedType ? 2 : 1);
  const [formData, setFormData] = useState<FormData>({
    ...initialFormData,
    inquiryType: preselectedType || "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const submitInquiry = useMutation(api.inquiries.submitInquiry);

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

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.inquiryType) {
      newErrors.inquiryType = "Please select an inquiry type";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate type-specific fields
    switch (formData.inquiryType) {
      case "partnership":
        if (!formData.companyName.trim()) {
          newErrors.companyName = "Company name is required";
        }
        if (!formData.partnershipDescription.trim()) {
          newErrors.partnershipDescription = "Please describe the opportunity";
        }
        break;
      case "investment":
        if (!formData.investmentType) {
          newErrors.investmentType = "Please select an investment type";
        }
        if (!formData.investmentDescription.trim()) {
          newErrors.investmentDescription = "Please provide a brief description";
        }
        break;
      case "careers":
        if (!formData.positionInterest) {
          newErrors.positionInterest = "Please select a position area";
        }
        if (!formData.careerIntro.trim()) {
          newErrors.careerIntro = "Please provide a brief introduction";
        }
        break;
      case "other":
        if (!formData.otherMessage.trim()) {
          newErrors.otherMessage = "Please provide your message";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsSubmitting(true);
    try {
      await submitInquiry({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        inquiryType: formData.inquiryType as "partnership" | "investment" | "careers" | "other",
        // Partnership fields
        companyName: formData.companyName || undefined,
        industry: formData.industry || undefined,
        partnershipDescription: formData.partnershipDescription || undefined,
        timeline: formData.timeline || undefined,
        // Investment fields
        investmentType: formData.investmentType || undefined,
        amountRange: formData.amountRange || undefined,
        investmentDescription: formData.investmentDescription || undefined,
        // Careers fields
        positionInterest: formData.positionInterest || undefined,
        careerIntro: formData.careerIntro || undefined,
        // Other
        otherMessage: formData.otherMessage || undefined,
      });
      setIsSubmitted(true);
    } catch (error) {
      // Silently handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-semibold text-[#0F1320] mb-3">
          Thank You!
        </h3>
        <p className="text-[#64748B] max-w-md mx-auto mb-2">
          We&apos;ve received your inquiry and appreciate your interest in Ideal.
        </p>
        <p className="text-sm text-[#64748B]">
          <span className="font-medium text-[#0F1320]">
            You&apos;ll hear back from us within 1 business day
          </span>{" "}
          (excluding holidays).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                s === step
                  ? "bg-[#5F64E8] text-white"
                  : s < step
                  ? "bg-emerald-500 text-white"
                  : "bg-[#F6F4F1] text-[#64748B]"
              )}
            >
              {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-1 transition-colors duration-300",
                  s < step ? "bg-emerald-500" : "bg-[#E8E3DF]"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Inquiry Type */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-[#0F1320] mb-2">
              How can we help you?
            </h3>
            <p className="text-sm text-[#64748B]">
              Select the type of inquiry that best fits your needs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {inquiryTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => updateField("inquiryType", type.value as InquiryType)}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all duration-200",
                  formData.inquiryType === type.value
                    ? "border-[#5F64E8] bg-[#5F64E8]/5 ring-2 ring-[#5F64E8]/20"
                    : "border-[#E8E3DF] hover:border-[#5F64E8]/50 hover:bg-[#F6F4F1]/50"
                )}
              >
                <span className="font-medium text-[#0F1320]">{type.label}</span>
              </button>
            ))}
          </div>
          {errors.inquiryType && (
            <p className="text-sm text-red-500">{errors.inquiryType}</p>
          )}
        </div>
      )}

      {/* Step 2: Type-specific fields */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-[#0F1320] mb-2">
              {formData.inquiryType === "partnership" && "Partnership Details"}
              {formData.inquiryType === "investment" && "Investment Details"}
              {formData.inquiryType === "careers" && "Career Interest"}
              {formData.inquiryType === "other" && "Your Message"}
            </h3>
            <p className="text-sm text-[#64748B]">
              Tell us more about your inquiry
            </p>
          </div>

          {formData.inquiryType === "partnership" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Your company name"
                  error={!!errors.companyName}
                />
                {errors.companyName && (
                  <p className="text-sm text-red-500">{errors.companyName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => updateField("industry", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnershipDescription">
                  Describe the Opportunity *
                </Label>
                <Textarea
                  id="partnershipDescription"
                  value={formData.partnershipDescription}
                  onChange={(e) =>
                    updateField("partnershipDescription", e.target.value)
                  }
                  placeholder="Tell us about the licensing or partnership opportunity..."
                  error={!!errors.partnershipDescription}
                />
                {errors.partnershipDescription && (
                  <p className="text-sm text-red-500">
                    {errors.partnershipDescription}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) => updateField("timeline", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Expected timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {timelines.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {formData.inquiryType === "investment" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="investmentType">Investment Type *</Label>
                <Select
                  value={formData.investmentType}
                  onValueChange={(value) => updateField("investmentType", value)}
                >
                  <SelectTrigger className={errors.investmentType ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select investment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {investmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.investmentType && (
                  <p className="text-sm text-red-500">{errors.investmentType}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountRange">Investment Amount Range</Label>
                <Select
                  value={formData.amountRange}
                  onValueChange={(value) => updateField("amountRange", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select amount range" />
                  </SelectTrigger>
                  <SelectContent>
                    {amountRanges.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investmentDescription">
                  Brief Description *
                </Label>
                <Textarea
                  id="investmentDescription"
                  value={formData.investmentDescription}
                  onChange={(e) =>
                    updateField("investmentDescription", e.target.value)
                  }
                  placeholder="Tell us about your investment interest and goals..."
                  error={!!errors.investmentDescription}
                />
                {errors.investmentDescription && (
                  <p className="text-sm text-red-500">
                    {errors.investmentDescription}
                  </p>
                )}
              </div>
            </>
          )}

          {formData.inquiryType === "careers" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="positionInterest">Area of Interest *</Label>
                <Select
                  value={formData.positionInterest}
                  onValueChange={(value) => updateField("positionInterest", value)}
                >
                  <SelectTrigger className={errors.positionInterest ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select area of interest" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.positionInterest && (
                  <p className="text-sm text-red-500">
                    {errors.positionInterest}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resumePlaceholder">Resume / Portfolio</Label>
                <div className="border-2 border-dashed border-[#E8E3DF] rounded-lg p-6 text-center hover:border-[#5F64E8]/50 transition-colors cursor-pointer">
                  <p className="text-sm text-[#64748B]">
                    Drop your resume here or click to upload
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    PDF, DOC, or DOCX (max 5MB)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="careerIntro">Brief Introduction *</Label>
                <Textarea
                  id="careerIntro"
                  value={formData.careerIntro}
                  onChange={(e) => updateField("careerIntro", e.target.value)}
                  placeholder="Tell us about yourself, your experience, and what excites you about Ideal..."
                  error={!!errors.careerIntro}
                />
                {errors.careerIntro && (
                  <p className="text-sm text-red-500">{errors.careerIntro}</p>
                )}
              </div>
            </>
          )}

          {formData.inquiryType === "other" && (
            <div className="space-y-2">
              <Label htmlFor="otherMessage">Your Message *</Label>
              <Textarea
                id="otherMessage"
                value={formData.otherMessage}
                onChange={(e) => updateField("otherMessage", e.target.value)}
                placeholder="How can we help you?"
                className="min-h-[160px]"
                error={!!errors.otherMessage}
              />
              {errors.otherMessage && (
                <p className="text-sm text-red-500">{errors.otherMessage}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Contact Information */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-[#0F1320] mb-2">
              Your Contact Information
            </h3>
            <p className="text-sm text-[#64748B]">
              How can we reach you?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Your full name"
              error={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@example.com"
              error={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone Number{" "}
              <span className="text-[#64748B] font-normal">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <Button type="button" variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <Button type="button" onClick={handleNext}>
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Inquiry"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
