'use client';

import { Download, QrCode } from 'lucide-react';

/**
 * MEMBER ID CARD COMPONENT
 * 
 * Displays member ID card inline in dashboard with download option
 */

export interface MemberCardData {
  memberName: string;
  memberId: string;
  planName: string;
  effectiveDate: string;
  barcode: string;
  networks: {
    careington: { name: string; memberUrl: string };
    dialCare: { name: string; memberUrl: string };
    toothlens: { name: string; memberUrl: string };
  };
  supportPhone: string;
  supportEmail: string;
}

interface MemberIdCardProps {
  cardData: MemberCardData;
  onDownload?: () => void;
}

export default function MemberIdCard({ cardData, onDownload }: MemberIdCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Your Member ID Card</h3>
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            <Download size={16} />
            Download PDF
          </button>
        )}
      </div>

      {/* Card Display */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-8 shadow-lg"
        style={{
          backgroundImage: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
        }}
      >
        {/* Card Header */}
        <div className="mb-6 pb-4 border-b border-white border-opacity-20">
          <h4 className="text-xl font-bold">Ideal Health Oral Care</h4>
          <p className="text-white text-opacity-80 text-sm">Member ID Card</p>
        </div>

        {/* Card Content Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-white text-opacity-70 uppercase tracking-wider">Member Name</p>
            <p className="text-lg font-bold mt-1">{cardData.memberName}</p>
          </div>

          <div>
            <p className="text-xs text-white text-opacity-70 uppercase tracking-wider">Member ID</p>
            <p className="text-lg font-bold font-mono mt-1">{cardData.memberId}</p>
          </div>

          <div>
            <p className="text-xs text-white text-opacity-70 uppercase tracking-wider">Plan</p>
            <p className="text-lg font-bold mt-1">{cardData.planName}</p>
          </div>

          <div>
            <p className="text-xs text-white text-opacity-70 uppercase tracking-wider">Effective Date</p>
            <p className="text-lg font-bold mt-1">{cardData.effectiveDate}</p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-4 border-t border-white border-opacity-20">
          <p className="text-xs text-white text-opacity-70 mb-2">MEMBER NETWORKS & SERVICES</p>
          <p className="text-xs leading-relaxed text-white">
            {cardData.networks.careington.name} • {cardData.networks.dialCare.name} • AI Oral Scanning
          </p>
          <p className="text-xs text-white text-opacity-60 mt-3">
            {cardData.supportPhone} • {cardData.supportEmail}
          </p>
        </div>
      </div>

      {/* Network Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <a
          href={cardData.networks.careington.memberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <p className="font-semibold text-slate-900 text-sm">{cardData.networks.careington.name}</p>
          <p className="text-slate-600 text-xs mt-1">Dental discounts & network access</p>
        </a>

        <a
          href={cardData.networks.dialCare.memberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <p className="font-semibold text-slate-900 text-sm">{cardData.networks.dialCare.name}</p>
          <p className="text-slate-600 text-xs mt-1">Teledentistry & consultations</p>
        </a>

        <a
          href={cardData.networks.toothlens.memberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <p className="font-semibold text-slate-900 text-sm">AI Oral Scanning</p>
          <p className="text-slate-600 text-xs mt-1">AI-powered smile analysis</p>
        </a>
      </div>
    </div>
  );
}
