"use client";

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import type { Locale } from "./config";
import type { ClientDictionary } from "./dictionaries";

interface I18nValue {
  locale: Locale;
  /** Only the sections client components use; see CLIENT_SECTIONS. */
  dict: ClientDictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Set once in the [lang] layout; client components read strings from here. */
export function I18nProvider({
  locale,
  dict,
  children,
}: I18nValue & { children: ReactNode }) {
  useEffect(() => {
    // Marks the page as interactive. End-to-end tests wait for this before typing or clicking,
    // so they never act on server HTML that React has not taken over yet.
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>.");
  return value;
}
