import Head from "next/head";
import Image from "next/image";
import HealthHeader from "@/components/health/HealthHeader";


// Nexus Health - A comprehensive health plan by Ryze
// Currently launching with oral health care as the foundation, expanding to additional health services

export default function HealthLanding() {
  return (
    <div className="health-landing">
      <Head>
        <title>Nexus Health | Modern Health Plans Made Simple</title>
        <meta name="description" content="Nexus Health by Ryze - A modern health plan that puts you first. Starting with virtual-first oral care, we're building the future of accessible, affordable healthcare." />
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
                <Image src="/health-assets/main_2320x900-1.jpg" alt="Woman using a phone to take control of her health" width={2320} height={900} className="hero-home__img" priority />
              </picture>
            </div>
          </div>
          <div className="row">
            <div className="col-8">
              <div className="hero-home__heading">
                <div className="hero-home__subtitle">NEXUS HEALTH</div>
                <h1>Health Plans That Work For You</h1>
                <p className="hero-home__descr">Meet Nexus Health—two powerful plans designed to support your wellness journey: weight management with GLP-1 support and comprehensive oral health care.</p>
                <a className="button button--primary" href="#plans">
                  Explore Plans
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Plans */}
      <section className="related-posts section">
        <div className="container">
          <div className="heading-block">
            <h2>Nexus Health Plans</h2>
            <p className="heading-block__descr">Choose the plan that fits your health goals.</p>
          </div>
          <div className="related-posts__grid">
            <div className="related-posts__card">
              <img src="/health-assets/oral-health_1086x1024.jpg" alt="Wellness GLP Plan" />
              <h4>Wellness GLP Plan</h4>
              <p style={{fontSize: '0.9375rem', marginBottom: '12px'}}>24/7/365 access to clinical support, GLP-1 and weight management medications, personalized treatment plans, nutrition coaching, and more.</p>
              <a href="#plans" className="link-arrow">Learn More</a>
            </div>
            <div className="related-posts__card">
              <img src="/health-assets/kid_thumbs_up.jpg" alt="Oral Health Plan" />
              <h4>Oral Health Plan</h4>
              <p style={{fontSize: '0.9375rem', marginBottom: '12px'}}>Toothlens AI oral scanning, teledentistry consultations, discount offerings, and access to our nationwide provider network.</p>
              <a href="/health/dental" className="link-arrow">Learn More</a>
            </div>
            <div className="related-posts__card">
              <img src="/health-assets/talk-live_1086x1024.jpg" alt="More Coming Soon" />
              <h4>More Services Coming</h4>
              <p style={{fontSize: '0.9375rem', marginBottom: '12px'}}>Nexus Health is expanding with additional health services and specialties. Stay tuned for announcements.</p>
              <div className="link-arrow">View All</div>
            </div>
          </div>
        </div>
      </section>

      {/* Wellness GLP Plan Details */}
      <section className="our-use-case section bg--blue">
        <div className="container">
          <div className="heading-block">
            <h2>Wellness GLP Plan</h2>
            <p className="heading-block__descr">Comprehensive weight management and wellness support, 24/7/365.</p>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/image-2-1.png" alt="Weight management support" />
            </div>
            <ul className="our-use-case__list">
              <li>24/7/365 Clinical Support Team</li>
              <li>GLP-1 & Weight Loss Medications</li>
              <li>Personalized Treatment Plans</li>
              <li>Initial Health Assessment</li>
              <li>Lab Testing & Monitoring</li>
              <li>Nutrition & Dietary Coaching</li>
              <li>Goal Setting & Education</li>
              <li>Ongoing Provider Support</li>
            </ul>
            <div className="our-use-case__btn_w"><a className="button button--accent" href="#plans">Explore Wellness GLP</a></div>
          </div>
        </div>
      </section>

      {/* Care Team */}
      <section className="one-team section bg--white">
        <div className="container">
          <div className="one-team__row" style={{display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'flex-start'}}>
            <div className="one-team__col_img" style={{flex: '1 1 400px', maxWidth: '500px'}}>
              <img src="/health-assets/d1-team_896x1352-opt2.jpg" alt="Nexus Health care team collaborating" style={{maxWidth: '100%', height: 'auto', objectFit: 'cover', borderRadius: '1.25rem'}} />
            </div>
            <div className="one-team__col_info" style={{flex: '1 1 400px'}}>
                <h3>Your Nexus Health Care Team</h3>
                <p>Every team member across both plans is dedicated to supporting your specific health goals. Whether you're managing weight, improving your smile, or both—we've got a team ready to help.</p>
              <div className="faq__list">
                <div className="accordion">
                  <h4>Clinical Providers</h4>
                  <div>Board-certified clinicians specializing in weight management, nutrition, and overall wellness, available 24/7 for your care.</div>
                </div>
                <div className="accordion">
                  <h4>Care Advisors</h4>
                  <div>Your personal advocates who coordinate your care, answer questions, and ensure you're getting the support you need at every step.</div>
                </div>
                <div className="accordion">
                  <h4>Wellness Coaches</h4>
                  <div>Certified experts in health and prevention who provide personalized guidance, tips, and recommendations tailored just for you.</div>
                </div>
                <div className="accordion">
                  <h4>Care Coordinators</h4>
                  <div>Behind-the-scenes heroes who handle scheduling, referrals, and logistics so you can focus on what really matters—your health.</div>
                </div>
                <div className="accordion">
                  <h4>Health Specialists</h4>
                  <div>Our nationwide network of providers offer virtual consultations, treatment coordination, and seamless access to in-person care when needed.</div>
                </div>
              </div>
              <a className="button button--primary" href="#plans">Choose Your Plan</a>
            </div>
          </div>
        </div>
      </section>

      {/* How to Get Started */}
      <section className="our-service section bg--blue" id="plans">
        <div className="container">
          <div className="heading-block">
            <h2>Getting Started With Nexus Health</h2>
            <p className="heading-block__descr">Simple enrollment, immediate access to care.</p>
          </div>
          <div className="our-service__row">
            <div className="our-service__list">
              <div className="service">
                <h4>1. Select Your Plan</h4>
                <p>Choose between our Wellness GLP Plan for weight management support or our Oral Health Plan for smile health. You can select both if you want comprehensive coverage.</p>
              </div>
              <div className="service">
                <h4>2. Complete Your Enrollment</h4>
                <p>Quick, straightforward enrollment takes just a few minutes online. Provide basic health information and select your preferences.</p>
              </div>
              <div className="service">
                <h4>3. Get Your Initial Assessment</h4>
                <p>Schedule your first appointment with a care provider or dentist. For the Wellness GLP Plan, we'll start with a comprehensive health assessment.</p>
              </div>
              <div className="service">
                <h4>4. Start Your Health Journey</h4>
                <p>Begin receiving personalized treatment plans, medications (if applicable), coaching, and ongoing support from your care team.</p>
              </div>
              <div className="service">
                <h4>5. Achieve Your Goals</h4>
                <p>With 24/7 support and a coordinated care team, you'll have everything you need to reach your health and wellness goals.</p>
              </div>
            </div>
            <div className="our-service__img col-6">
              <img src="/health-assets/smilescan_1086x1024.jpg" alt="Nexus Health Plans" />
            </div>
            <div className="our-service__btn_w"><a className="button button--primary" href="/health/plans">Enroll Now</a></div>
          </div>
        </div>
      </section>

      {/* Why Nexus Health */}
      <section className="benefits section bg--white">
        <div className="container">
          <h2>Why Nexus Health Plans Work Better</h2>
          <ul className="benefits__list">
            <li><strong>24/7/365 Support</strong>: Round-the-clock access to clinical teams and care coordinators whenever you need support.</li>
            <li><strong>Medication Access</strong>: For the Wellness GLP Plan, immediate access to GLP-1 and weight management medications with personalized dosing.</li>
            <li><strong>AI-Powered Tools</strong>: From Toothlens oral scanning to personalized wellness tracking, technology enhances your care.</li>
            <li><strong>Transparent Pricing</strong>: No surprise bills. Plans are affordably priced with predictable costs.</li>
            <li><strong>Comprehensive Support</strong>: Nutrition coaching, oral health care, clinical monitoring, and ongoing guidance all coordinated together.</li>
            <li><strong>Flexible Options</strong>: Choose one plan or enroll in both for complete health coverage aligned with your needs.</li>
            <li><strong>Real Doctors & Dentists</strong>: Board-certified providers who actually care about your outcomes, available when you need them.</li>
          </ul>
        </div>
      </section>

      {/* For Employers/Organizations */}
      <section className="for-organization section bg--white">
        <div className="container">
          <div className="for-organization__row">
            <div className="for-organization__col">
              <h2>Health Plans for Your Organization</h2>
              <p>Offer your employees, members, or plan participants the Nexus Health difference. Our dual-plan approach—combining wellness support and oral health coverage—helps improve employee health, reduce healthcare costs, and increase satisfaction.</p>
              <div className="for-organization__btn_w">
                <a className="button button--accent" href="/organizations">For Employers</a>
                <a className="button button--primary" href="#contact">Schedule a Demo</a>
              </div>
            </div>
            <div className="for-organization__img">
              <img src="/health-assets/virtual-first_896x992-2.jpg" alt="Employers choosing Nexus Health" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq section">
        <div className="container">
          <h2>Questions About Nexus Health?</h2>
          <div className="faq__list">
            <div className="accordion">
              <h4>What's included in the Wellness GLP Plan?</h4>
              <div>The Wellness GLP Plan includes 24/7/365 access to clinical providers, GLP-1 and weight loss medications, personalized treatment plans, initial health assessment, lab testing, nutrition and dietary coaching, goal setting resources, and ongoing clinical supervision and support.</div>
            </div>
            <div className="accordion">
              <h4>What's included in the Oral Health Plan?</h4>
              <div>The Oral Health Plan features Toothlens AI-powered oral scanning for home monitoring, access to teledentistry consultations with qualified specialists, discount pricing on comprehensive oral health procedures, and connections to our nationwide network of providers for in-person appointments when needed.</div>
            </div>
            <div className="accordion">
              <h4>Can I enroll in both plans?</h4>
              <div>Absolutely! Many members choose to enroll in both the Wellness GLP Plan and Oral Health Plan for comprehensive health coverage. You can manage both plans through a single Nexus Health account.</div>
            </div>
            <div className="accordion">
              <h4>How much do the plans cost?</h4>
              <div>Both plans are affordably priced with transparent, predictable costs. Pricing varies based on the specific services selected and your individual health needs. Contact us or visit our pricing page for current rates and options.</div>
            </div>
            <div className="accordion">
              <h4>When will more health services be available?</h4>
              <div>We're actively expanding the Nexus Health platform. The Wellness GLP Plan and Oral Health Plan are our launch services, and we're planning to add additional health specialties and services over the coming months.</div>
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
                  <Image src="/nexus-health-logo.png" alt="Nexus Health logo" width={48} height={48} />
                </a>
                {/* ...footer form and links... */}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
