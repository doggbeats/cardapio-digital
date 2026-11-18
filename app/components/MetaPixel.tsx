"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "./CookieConsent";

type Fbq = (...args: [string, ...unknown[]]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: unknown;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  const [marketingAllowed, setMarketingAllowed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    function sync() {
      setMarketingAllowed(readConsent()?.marketing === true);
    }

    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const initialize = useCallback(() => {
    if (started.current || !PIXEL_ID || typeof window.fbq !== "function") return;
    started.current = true;
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
  }, []);

  useEffect(() => {
    if (marketingAllowed) initialize();
  }, [initialize, marketingAllowed]);

  if (!PIXEL_ID || !marketingAllowed) return null;

  return (
    <Script
      id="meta-pixel"
      src="https://connect.facebook.net/en_US/fbevents.js"
      strategy="afterInteractive"
      onLoad={initialize}
    />
  );
}
