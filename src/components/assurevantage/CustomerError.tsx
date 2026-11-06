"use client";
import { Component, type ReactNode } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import styles from "./experience.module.css";
export class CustomerError extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(error: unknown) {
    unstable_rethrow(error);
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.narrow}`} role="alert">
          <h1>We couldn’t load this information.</h1>
          <p>
            Please try again. If the issue continues, membership support can
            help.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={() => this.setState({ failed: false })}
            >
              Try again
            </button>
            <Link href="/assurevantage/help">Find support →</Link>
          </div>
        </div>
      </section>
    ) : (
      this.props.children
    );
  }
}
