import HeroSlideshow from "@/components/health/HeroSlideshow";
import HealthHeader from "@/components/health/HealthHeader";

// Ideal Oral Health Plan landing page
// Features comprehensive AI-powered oral health care with Toothlens and teledentistry

export default function OralHealthLanding() {
  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero Section with Slideshow */}
      <section className="hero-home section">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <HeroSlideshow />
            </div>
          </div>
          <div className="row">
            <div className="col-8">
              <div className="hero-home__heading">
                <div className="hero-home__subtitle">IDEAL ORAL HEALTH PLAN</div>
                <h1>Oral Care - Oral Health Plan Built on Innovation. </h1>
                <p className="hero-home__descr">Affordable accessible discount program, and tech-powered solutions that reduce costs and improve outcomes for individuals and employers.</p>
                <a className="button button--primary" href="#services">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Oral Health Plan Features Preview */}
      <section className="related-posts section">
        <div className="container">
          <div className="related-posts__grid">
            <div className="related-posts__card">
              <img src="/health-assets/toothlensscan_1086x1024.png" alt="Toothlens AI Scanning" />
              <h4>Toothlens AI Scanning</h4>
              <div className="link-arrow">AI-Powered Detection</div>
            </div>
            <div className="related-posts__card">
              <img src="/health-assets/teledentistr_1024x1024.png" alt="Teledentistry Consultations" />
              <h4>Teledentistry Consultations</h4>
              <div className="link-arrow">Expert Guidance 24/7</div>
            </div>
            <div className="related-posts__card">
              <img src="/health-assets/dentist-network-discount_1536x1024.png" alt="Dental Discount Network" />
              <h4>Dental Discount Network</h4>
              <div className="link-arrow">Nationwide Access</div>
            </div>
          </div>
          <div className="related-posts__btn_w">
            <a className="button button--primary" href="/health">Back to Health Plans</a>
          </div>
        </div>
      </section>

      {/* Oral Health Plan Details */}
      <section className="our-use-case section bg--blue">
        <div className="container">
          <div className="heading-block">
            <h2>What's Included in Your Oral Health Plan</h2>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/image-2-1.png" alt="Dentist providing teledentistry consultation" />
            </div>
            <ul className="our-use-case__list">
              <li>Toothlens AI-Powered Scanning</li>
              <li>24/7 Teledentistry Access</li>
              <li>Emergency Support</li>
              <li>Nationwide Dentist Network</li>
              <li>Discount Procedures</li>
              <li>Treatment Recommendations</li>
            </ul>
            <div className="our-use-case__btn_w"><a className="button button--accent" href="/health#enrollment">Enroll Now</a></div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="our-service section bg--blue" id="services">
        <div className="container">
          <div className="heading-block">
            <h2>Oral Health Plan Features</h2>
          </div>
          <div className="our-service__row">
            <div className="our-service__list">
              <div className="service">
                <h4>Toothlens AI Scanning</h4>
                <p>Take photos and get instant AI analysis of your oral health. Our advanced scanning technology identifies potential issues early and provides detailed health reports with actionable insights.</p>
              </div>
              <div className="service">
                <h4>Teledentistry Consultations</h4>
                <p>Connect with experienced dentists via video call anytime, anywhere. Get professional advice, diagnosis, and treatment recommendations from the comfort of home.</p>
              </div>
              <div className="service">
                <h4>Nationwide Dentist Network</h4>
                <p>Access our nationwide network of trusted specialists with negotiated discount rates. Find local partners for in-person procedures and treatments.</p>
              </div>
              <div className="service">
                <h4>Emergency Support</h4>
                <p>Experiencing pain or emergency concerns? Talk with a specialist immediately to get relief and guidance on next steps.</p>
              </div>
            </div>
            <div className="our-service__img col-6">
              <img src="/health-assets/toothlensscan_1086x1024.png" alt="Toothlens AI Scanning" />
            </div>
            <div className="our-service__btn_w"><a className="button button--primary" href="/health#enrollment">Get Started Today</a></div>
          </div>
        </div>
      </section>

      {/* Why Ideal Oral Health Works Better */}
      <section className="benefits section bg--white">
        <div className="container">
          <h2>Why Ideal Oral Health Works Better</h2>
          <ul className="benefits__list">
            <li><strong>Advanced AI Technology</strong>: Toothlens AI scanning detects issues early and provides detailed analysis without the cost of frequent in-person visits.</li>
            <li><strong>Always Available</strong>: 24/7 access to dentists and oral health coaches means you can address concerns at any time, including outside standard office hours.</li>
            <li><strong>Transparent Pricing</strong>: Know upfront what procedures cost with our nationwide provider network discounts. No surprise bills.</li>
            <li><strong>Expert Network</strong>: Access to a carefully selected network of trusted dentists nationwide, all vetted for quality care.</li>
            <li><strong>Preventative Focus</strong>: AI scanning and coaching help catch problems early, reducing costly treatments down the road.</li>
            <li><strong>Comprehensive Support</strong>: From emergency care to routine coaching, we're here for every aspect of your oral health journey.</li>
          </ul>
        </div>
      </section>

      {/* Getting Started */}
      <section className="our-use-case section bg--blue">
        <div className="container">
          <div className="heading-block">
            <h2>How to Get Started</h2>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/d1-team_896x1352-opt2.jpg" alt="Getting started with Ideal Oral Health" />
            </div>
            <ol className="our-use-case__list">
              <li><strong>Enroll in the Oral Health Plan</strong> - Create your Ideal Health account and select the Oral Health Plan at enrollment.</li>
              <li><strong>Complete Your Profile</strong> - Tell us about your oral health history and goals so we can personalize your care.</li>
              <li><strong>Take Your First Scan</strong> - Use Toothlens to get an AI analysis of your current oral health status.</li>
              <li><strong>Connect with a Dentist</strong> - Schedule your initial consultation to review results and create your care plan.</li>
              <li><strong>Start Your Journey</strong> - Access teledentistry, coaching, and network dentists as needed for ongoing care.</li>
            </ol>
            <div className="our-use-case__btn_w"><a className="button button--accent" href="/health">View All Plans</a></div>
          </div>
        </div>
      </section>

      {/* Oral Health Plan for Organizations */}
      <section className="for-organization section bg--white">
        <div className="container">
          <div className="for-organization__row">
            <div className="for-organization__col">
              <h2>Oral Health Plan for Your Team</h2>
              <p>Offer your employees a modern oral health plan that actually works. AI-powered scanning, 24/7 teledentistry, and nationwide provider discounts reduce costs, improve preventative care, and boost employee satisfaction.</p>
              <div className="for-organization__btn_w">
                <a className="button button--accent" href="/health">Learn About All Plans</a>
                <a className="button button--primary" href="/contact">Schedule a Demo</a>
              </div>
            </div>
            <div className="for-organization__img">
              <img src="/health-assets/virtual-first_896x992-2.jpg" alt="Team members discussing benefits" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq section">
        <div className="container">
          <h2>Oral Health Plan Questions?</h2>
          <div className="faq__list">
            <div className="accordion">
              <h4>What is the Ideal Oral Health Plan?</h4>
              <div>The Ideal Oral Health Plan is a comprehensive oral care solution featuring advanced AI technology (Toothlens for oral health scanning), 24/7 teledentistry access with experienced specialists, and a nationwide network of providers with discounted rates. It is designed to make oral care accessible, affordable, and preventative.</div>
            </div>
            <div className="accordion">
              <h4>How does Toothlens AI scanning work?</h4>
              <div>Toothlens is advanced AI technology that analyzes photos of your teeth and gums. Simply take clear photos and our AI provides a detailed oral health report identifying potential issues, calculating your oral health score, and recommending next steps. It is a convenient way to track your health between in-person visits.</div>
            </div>
            <div className="accordion">
              <h4>Can I use the Oral Health Plan for emergency care?</h4>
              <div>Yes! The Oral Health Plan includes 24/7 emergency support. If you're experiencing pain or have urgent concerns, you can connect with a specialist immediately via teledentistry to get guidance and relief recommendations.</div>
            </div>
            <div className="accordion">
              <h4>How do the nationwide dentist discounts work?</h4>
              <div>Ideal Health has partnerships with a nationwide network of licensed dentists. Plan members receive negotiated discount rates on procedures like cleanings, fillings, root canals, and more. You can search our network to find nearby dentists and see their discount rates before scheduling.</div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
