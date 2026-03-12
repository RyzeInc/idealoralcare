import Image from 'next/image';

export default function IdealHealthWordmark() {
  return (
    <a
      href="/health"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textDecoration: 'none',
        transition: 'opacity 0.2s ease',
        flexShrink: 0,
      }}
    >
      <Image
        src="/ideal-oral-health-logo.png"
        alt="Ideal Oral Health"
        width={113}
        height={54}
        style={{ objectFit: 'contain' }}
        priority
      />
    </a>
  );
}
