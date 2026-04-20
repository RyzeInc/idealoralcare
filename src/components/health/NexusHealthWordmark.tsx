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
        width={136}
        height={65}
        style={{ objectFit: 'contain' }}
        priority
      />
    </a>
  );
}
