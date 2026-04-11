export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  category: string;
  readTime: string;
  keywords: string[];
  /** True = purely educational content, no product CTA. False/undefined = standard promotional CTA. */
  editorial?: boolean;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "dental-discount-plans-vs-dental-insurance",
    title: "Dental Discount Plans vs. Dental Insurance: What's the Difference?",
    description:
      "Understand the key differences between dental discount plans and traditional dental insurance — including costs, coverage, waiting periods, and which option saves you more.",
    datePublished: "2026-01-14",
    category: "Guides",
    readTime: "7 min read",
    keywords: ["dental discount plan", "dental insurance", "dental insurance alternative", "dental savings plan"],
  },
  {
    slug: "alternatives-to-dental-insurance",
    title: "5 Affordable Alternatives to Traditional Dental Insurance in 2026",
    description:
      "Traditional dental insurance isn't your only option. Explore five affordable alternatives including dental discount plans, teledentistry, and community health centers.",
    datePublished: "2026-01-28",
    category: "Guides",
    readTime: "8 min read",
    keywords: ["alternatives to dental insurance", "affordable dental care", "dental discount network", "no insurance dental"],
  },
  {
    slug: "what-to-do-when-you-cant-afford-dental-insurance",
    title: "What To Do When You Can't Afford Dental Insurance",
    description:
      "If dental insurance is out of your budget, you still have options. Learn practical ways to get affordable dental care without traditional insurance coverage.",
    datePublished: "2026-02-10",
    category: "Advice",
    readTime: "6 min read",
    keywords: ["can't afford dental insurance", "cheap dental care", "dental care without insurance", "low cost dental"],
  },
  {
    slug: "how-to-get-dental-care-without-insurance",
    title: "How to Get Dental Care Without Insurance: A Complete Guide",
    description:
      "No dental insurance? No problem. This guide covers dental discount plans, sliding-scale clinics, teledentistry, and other ways to get quality dental care affordably.",
    datePublished: "2026-02-24",
    category: "Guides",
    readTime: "9 min read",
    keywords: ["dental care without insurance", "uninsured dental care", "affordable dentist", "dental discount plan"],
  },
  {
    slug: "what-is-teledentistry",
    title: "What Is Teledentistry and How Does It Work?",
    description:
      "Teledentistry lets you consult licensed dentists from your phone or computer, 24/7. Learn how virtual dental visits work, what they cover, and when to use them.",
    datePublished: "2026-03-05",
    category: "Education",
    readTime: "6 min read",
    keywords: ["teledentistry", "virtual dental visit", "online dentist", "telehealth dental"],
    editorial: true,
  },
  {
    slug: "ai-oral-health-scanning-future-of-dental",
    title: "AI Oral Health Scanning: The Future of Dental Checkups",
    description:
      "AI-powered oral health scanning lets you screen your teeth from home using your smartphone. Learn how the technology works and what it can detect.",
    datePublished: "2026-03-12",
    category: "Technology",
    readTime: "5 min read",
    keywords: ["AI dental scan", "oral health scan", "AI dentistry", "dental technology", "dental screening at home"],
    editorial: true,
  },
  {
    slug: "why-families-choose-dental-discount-plans",
    title: "Why More Families Are Choosing Dental Discount Plans Over Insurance",
    description:
      "Family dental insurance can be expensive and restrictive. Discover why dental discount plans are becoming the preferred choice for budget-conscious families.",
    datePublished: "2026-03-19",
    category: "Guides",
    readTime: "7 min read",
    keywords: ["family dental plan", "family dental discount", "dental plan for families", "affordable family dental"],
  },
  {
    slug: "how-dental-discount-networks-work",
    title: "How Dental Discount Networks Work: Everything You Need to Know",
    description:
      "Dental discount networks negotiate reduced rates with dentists nationwide. Learn how they work, what to expect at the dentist, and how much you can save.",
    datePublished: "2026-03-30",
    category: "Education",
    readTime: "6 min read",
    keywords: ["dental discount network", "dental savings network", "how dental discounts work", "dental network"],
    editorial: true,
  },
  {
    slug: "preventive-dental-care-saves-money",
    title: "How Preventive Dental Care Saves You Thousands of Dollars",
    description:
      "Skipping regular dental checkups can cost you thousands in emergency procedures. Learn why preventive care is the best investment for your oral health and wallet.",
    datePublished: "2026-04-03",
    category: "Advice",
    readTime: "5 min read",
    keywords: ["preventive dental care", "dental checkup cost", "save money dental", "dental health tips"],
    editorial: true,
  },
  {
    slug: "no-waiting-period-dental-plans",
    title: "No Waiting Period Dental Plans: Get Coverage That Starts Immediately",
    description:
      "Tired of waiting 6–12 months for dental benefits? Dental discount plans activate within 24 hours with no waiting periods, no exclusions, and no annual maximums.",
    datePublished: "2026-04-11",
    category: "Guides",
    readTime: "6 min read",
    keywords: ["no waiting period dental", "immediate dental coverage", "dental plan no waiting", "same day dental plan"],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
