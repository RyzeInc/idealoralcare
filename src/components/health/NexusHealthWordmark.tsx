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
        src="/ideal-health-logo.png"
        alt="Ideal Health"
        width={130}
        height={44}
        style={{ objectFit: 'contain' }}
        priority
      />
    </a>
  );
}
