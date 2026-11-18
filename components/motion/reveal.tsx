"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { observeOnce } from "@/lib/motion/observe";

type RevealTag = "div" | "li" | "section" | "p" | "header" | "figure";

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: RevealTag;
  /** Milliseconds to wait after the element comes into view, for staggered groups. */
  delay?: number;
  children: ReactNode;
}

/**
 * Rises and fades its content in the first time it scrolls into view. The hidden state
 * lives in CSS (app/globals.css) and only applies when scripts run and motion is welcome,
 * so server HTML is readable on its own.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  style,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return observeOnce(node, () => setShown(true));
  }, []);

  return (
    <Tag
      // Each tag accepts an HTMLElement ref; TypeScript cannot narrow the union here.
      ref={ref as React.Ref<never>}
      data-reveal={shown ? "shown" : "hidden"}
      style={
        delay
          ? ({ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties)
          : style
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}
