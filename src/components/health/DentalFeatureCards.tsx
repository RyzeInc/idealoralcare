'use client';

import { useState } from 'react';
import FeatureModal from './FeatureModal';

export default function DentalFeatureCards() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<'toothlens' | 'teledentistry' | 'network'>('toothlens');

  const openModal = (feature: 'toothlens' | 'teledentistry' | 'network') => {
    setSelectedFeature(feature);
    setModalOpen(true);
  };

  return (
    <>
      <div className="related-posts__grid">
        <button 
          className="related-posts__card"
          onClick={() => openModal('toothlens')}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', width: '100%' }}
        >
          <img src="/health-assets/toothlensscan_1086x1024.png" alt="Toothlens AI Scanning" />
          <h4>Toothlens AI Scanning</h4>
          <div className="link-arrow">AI-Powered Detection</div>
        </button>
        
        <button 
          className="related-posts__card"
          onClick={() => openModal('teledentistry')}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', width: '100%' }}
        >
          <img src="/health-assets/teledentistr_1024x1024.png" alt="Teledentistry Consultations" />
          <h4>Teledentistry Consultations</h4>
          <div className="link-arrow">Expert Guidance 24/7</div>
        </button>
        
        <button 
          className="related-posts__card"
          onClick={() => openModal('network')}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', width: '100%' }}
        >
          <img src="/health-assets/dentist-network-discount_1536x1024.png" alt="Dental Discount Network" />
          <h4>Dental Discount Network</h4>
          <div className="link-arrow">Nationwide Access</div>
        </button>
      </div>

      <FeatureModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        feature={selectedFeature}
      />
    </>
  );
}
