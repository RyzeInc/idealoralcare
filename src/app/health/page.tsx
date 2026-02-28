import Head from "next/head";
import Image from "next/image";
import HealthHeader from "@/components/health/HealthHeader";

// Ideal Health - Comprehensive oral health plan
// Toothlens AI scanning, Dial Care teledentistry, Careington network access

export default function HealthLanding() {
  return (
    <div className="health-landing">
      <Head>
        <title>Ideal Health Oral Health Plan | Affordable Dental Care</title>
        <meta name="description" content="Ideal Health Oral Health Plan - Toothlens AI oral scanning, Dial Care teledentistry, and Careington POS dental network access. $15/mo or $13/mo with ACH." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Shared Header */}
      <HealthHeader />

      {/* Hero Section */}
      <section className="hero-home section">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <picture className="hero-home__img_w">
                <source srcSet="/health-assets/main_800x900-1-768x864.jpg" media="(max-width: 768px)" />
                <Image src="/health-assets/main_2320x900-1.jpg" alt="Woman taking control of her dental health" width={2320} height={900} className="hero-home__img" priority />
              </picture>
            </div>
          </div>
          <div className="row">
            <div className="col-8">
              <div className="hero-home__heading">
                <div className="hero-home__subtitle">IDEAL HEALTH</div>
                <h1>Oral Health Coverage That Works For You</h1>
                <p className="hero-home__descr">Comprehensive dental coverage starting at just $15/month. Get Toothlens AI oral scanning, Dial Care teledentistry access, and the Careington POS network—all in one affordable plan.</p>
                <a className="button button--primary" href="/health/dental">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Plan */}
      <section className="related-posts section">
        <div className="container">
          <div className="heading-block">
            <h2>Ideal Health Oral Health Plan</h2>
            <p className="heading-block__descr">Everything you need for comprehensive dental coverage.</p>
          </div>
          <div className="related-posts__grid" style={{maxWidth: '600px', margin: '0 auto'}}>
            <div className="related-posts__card" style={{width: '100%'}}>
              <img src="/health-assets/kid_thumbs_up.jpg" alt="Ideal Health Oral Health Plan" />
              <h4>Oral Health Plan</h4>
              <p style={{fontSize: '0.9375rem', marginBottom: '12px'}}>
                Toothlens AI oral scanning for home monitoring, 24/7 Dial Care teledentistry consultations, and access to the Careington POS dental discount network nationwide.
              </p>
              <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1e3a5f', marginBottom: '12px'}}>
                <span>$15/mo</span> or <span style={{color: '#14b8a6'}}>$13/mo with ACH</span>
              </div>
              <a href="/health/dental" className="link-arrow">Get Started</a>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Features */}
      <section className="our-use-case section bg--blue">
        <div className="container">
          <div className="heading-block">
            <h2>What's Included</h2>
            <p className="heading-block__descr">Comprehensive dental care, all in one affordable plan.</p>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/smilescan_1086x1024.jpg" alt="Toothlens AI scanning" />
            </div>
            <ul className="our-use-case__list">
              <li>Toothlens Smart Check AI Oral Scanning</li>
              <li>24/7 Dial Care Teledentistry Access</li>
              <li>Careington POS Network Discounts</li>
              <li>Member ID Card (Physical & Digital)</li>
              <li>Emergency Dental Support</li>
              <li>Preventive Care Guidance</li>
              <li>Network Provider Assistance</li>
              <li>Ongoing Care Coordination</li>
            </ul>
            <div className="our-use-case__btn_w"><a className="button button--accent" href="/health/dental">Explore the Plan</a></div>
          </div>
        </div>
      </section>

      {/* Care Team */}
      <section className="one-team section bg--white">
        <div className="container">
          <div className="one-team__row" style={{display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'flex-start'}}>
            <div className="one-team__col_img" style={{flex: '1 1 400px', maxWidth: '500px'}}>
              <img src="/health-assets/d1-team_896x1352-opt2.jpg" alt="Ideal Health care team" style={{maxWidth: '100%', height: 'auto', objectFit: 'cover', borderRadius: '1.25rem'}} />
            </div>
            <div className="one-team__col_info" style={{flex: '1 1 400px'}}>
              <h3>Your Ideal Health Support Team</h3>
              <p>Our team is dedicated to supporting your oral health goals. Whether you're preventive-focused or managing complex dental needs, we have resources to help.</p>
              <div className="faq__list">
                <div className="accordion">
                  <h4>Teledentistry Specialists</h4>
                  <div>Licensed dental professionals available 24/7 via Dial Care for consultations, treatment planning, and emergency support.</div>
                </div>
                <div className="accordion">
                  <h4>Care Coordinators</h4>
                  <div>Our team helps you navigate the Careington network, find in-network providers, and coordinate your in-person care.</div>
                </div>
                <div className="accordion">
                  <h4>Toothlens Support</h4>
                  <div>Get help optimizing your AI-powered oral scanning, interpreting results, and connecting with providers for follow-up care.</div>
                </div>
                <div className="accordion">
                  <h4>Member Services</h4>
                  <div>We're here to answer questions about coverage, billing, provider access, and any other plan details you need.</div>
                </div>
              </div>
              <a className="button button--primary" href="/health/dental">Choose Your Plan</a>
            </div>
          </div>
        </div>
      </section>

      {/* How to Get Started */}
      <section className="our-service section bg--blue" id="plans">
        <div className="container">
          <div className="heading-block">
            <h2>Getting Started With Ideal Health</h2>
            <p className="heading-block__descr">Simple enrollment, immediate access to dental care.</p>
          </div>
          <div className="our-service__row">
            <div className="our-service__list">
              <div className="service">
                <h4>1. Review the Plan</h4>
                <p>Learn about our Oral Health Plan, pricing options, and what's included. See if it's right for your dental care needs.</p>
              </div>
              <div className="service">
                <h4>2. Enroll Online</h4>
                <p>Quick enrollment takes just a few minutes. Choose your cadence (monthly or annual savings) and payment method (card or ACH).</p>
              </div>
              <div className="service">
                <h4>3. Get Your Member ID</h4>
                <p>Immediately receive your digital and physical member ID cards with access information for all plan services.</p>
              </div>
              <div className="service">
                <h4>4. Activate Your Services</h4>
                <p>Set up your Toothlens Smart Check account, download the Dial Care app, and access the Careington provider directory.</p>
              </div>
              <div className="service">
                <h4>5. Start Your Dental Journey</h4>
                <p>Use AI scanning for home monitoring, get teledentistry consultations when needed, and access discounted in-network care.</p>
              </div>
            </div>
            <div className="our-service__img col-6">
              <img src="/health-assets/smilescan_1086x1024.jpg" alt="Ideal Health Oral Health Plan" />
            </div>
            <div className="our-service__btn_w"><a className="button button--primary" href="/health/dental">Enroll Now</a></div>
          </div>
        </div>
      </section>

      {/* Why Ideal Health */}
      <section className="benefits section bg--white">
        <div className="container">
          <h2>Why Ideal Health Stands Out</h2>
          <ul className="benefits__list">
            <li><strong>Affordable Pricing</strong>: Just $15/month (or $13 with ACH). No hidden fees or surprise bills.</li>
            <li><strong>24/7 Support</strong>: Dial Care teledentistry available round-the-clock whenever you need dental guidance.</li>
            <li><strong>AI-Powered Screening</strong>: Toothlens Smart Check puts oral health monitoring in your hands with AI-powered analysis.</li>
            <li><strong>Wide Network Access</strong>: The Careington POS network includes thousands of dentists nationwide for discounted care.</li>
            <li><strong>Flexible Care Options</strong>: Mix remote teledentistry with in-network provider visits—whatever works best for you.</li>
            <li><strong>Transparent Enrollment</strong>: No long-term contracts. Choose month-to-month or annual billing with ACH savings.</li>
            <li><strong>Actual Dentists</strong>: Real, licensed dental professionals providing real care and support.</li>
          </ul>
        </div>
      </section>

      {/* For Employers/Organizations */}
      <section className="for-organization section bg--white">
        <div className="container">
          <div className="for-organization__row">
            <div className="for-organization__col">
              <h2>Dental Coverage for Your Organization</h2>
              <p>Offer employees or group members the Ideal Health Oral Health Plan. It's an affordable, high-value benefit that improves employee satisfaction and health outcomes. Perfect for small groups, large employers, associations, and unions.</p>
              <div className="for-organization__btn_w">
                <a className="button button--accent" href="#contact">For Groups</a>
                <a className="button button--primary" href="#contact">Schedule a Demo</a>
              </div>
            </div>
            <div className="for-organization__img">
              <img src="/health-assets/virtual-first_896x992-2.jpg" alt="Ideal Health for organizations" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq section">
        <div className="container">
          <h2>Questions About Ideal Health?</h2>
          <div className="faq__list">
            <div className="accordion">
              <h4>What exactly is included in the plan?</h4>
              <div>The Ideal Health Oral Health Plan includes Toothlens Smart Check AI scanning for at-home monitoring, 24/7 access to Dial Care teledentistry specialists, member ID cards, and discounted access to the Careington POS network of thousands of dentists nationwide.</div>
            </div>
            <div className="accordion">
              <h4>Is this dental insurance?</h4>
              <div>No, this is a savings-based dental plan with discounts and teledentistry access. It's not replacement health insurance but works great as a complementary benefit for oral health care and prevention.</div>
            </div>
            <div className="accordion">
              <h4>How much does it cost?</h4>
              <div>The Ideal Health Oral Health Plan costs $15/month if you pay with a credit card, or $13/month if you choose automatic ACH bank transfers. Annual billing options are also available with additional savings.</div>
            </div>
            <div className="accordion">
              <h4>Can I cancel anytime?</h4>
              <div>Yes! There are no long-term contracts or cancellation fees. You can cancel your membership at any time, with your final payment as your last. We think you'll love the plan—but it's your choice.</div>
            </div>
            <div className="accordion">
              <h4>How do I access Toothlens and Dial Care?</h4>
              <div>After enrollment, you'll receive instructions to download the Toothlens Smart Check and Dial Care apps. Both are simple to use and available on iOS and Android. Teledentistry consultations can be scheduled 24/7 through the app.</div>
            </div>
            <div className="accordion">
              <h4>Are there any restrictions or requirements?</h4>
              <div>This plan is available to individuals and groups. There's no medical underwriting—anyone can enroll. Simply review the terms to ensure the plan aligns with your dental care needs.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer" id="footer">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="site-footer__row_top">
                <a href="/health" className="site-footer__logo_w">
                  <Image src="/ideal-health-logo.png" alt="Ideal Health logo" width={48} height={48} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
