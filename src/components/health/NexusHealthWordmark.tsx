import Image from 'next/image';
import styles from './NexusHealthWordmark.module.css';

export default function NexusHealthWordmark() {
  return (
    <a href="/health" className={styles.wordmark}>
      <div className={styles.icon}>
        <Image 
          src="/nexus-health-logo.png" 
          alt="Nexus Health" 
          width={44} 
          height={44} 
        />
      </div>
      <div className={styles.text}>
        <div className={styles.primary}>Nexus</div>
        <div className={styles.secondary}>Health Plans</div>
      </div>
    </a>
  );
}
