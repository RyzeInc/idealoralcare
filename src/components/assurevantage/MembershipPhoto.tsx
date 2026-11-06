import Image from "next/image";
import styles from "./experience.module.css";
const PHOTOS = {
  essentials: ["happy-family.png", "A family together at home"],
  bfl: ["mental-health-pic.png", "A counselor talking with a member"],
  oral: ["pinky-swear.png", "Two hands linked in a pinky promise"],
};
export function MembershipPhoto({ program }: { program: keyof typeof PHOTOS }) {
  const [file, alt] = PHOTOS[program];
  return (
    <div className={styles.membershipPhoto}>
      <Image
        src={`/newideal/site-files/${file}`}
        alt={alt}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 380px"
      />
    </div>
  );
}
