'use client';

import { useRef } from 'react';
import { Device, type Call } from '@twilio/voice-sdk';

/**
 * In-browser softphone for click-to-dial's Twilio path. Lazily creates and
 * registers a Device only when a rep actually places a call on this
 * provider — not on every page load, so reps on "manual"/"tel"/etc. never
 * see a mic permission prompt or spend a token fetch they don't need.
 *
 * NEEDS a real Twilio account (see src/app/api/twilio/token/route.ts) —
 * placeCall() surfaces that as a normal rejected promise if unconfigured.
 */
export function useTwilioCall() {
  const deviceRef = useRef<Device | null>(null);

  async function getDevice(): Promise<Device> {
    if (deviceRef.current) return deviceRef.current;

    const res = await fetch('/api/twilio/token');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Could not fetch a Twilio Voice token');
    }
    const { token } = await res.json();

    const device = new Device(token, { logLevel: 'error' });
    await device.register();
    deviceRef.current = device;
    return device;
  }

  async function placeCall(e164: string): Promise<Call> {
    const device = await getDevice();
    return await device.connect({ params: { To: e164 } });
  }

  function destroy() {
    deviceRef.current?.destroy();
    deviceRef.current = null;
  }

  return { placeCall, destroy };
}
