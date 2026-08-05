"use client";

import { useEffect, useState } from "react";
import styles from "./BackToTop.module.scss";

const showAfterScroll = 320;

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > showAfterScroll);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      className={`${styles.backToTop} ${isVisible ? styles.visible : ""}`}
      type="button"
      aria-label="回到頁首"
      title="回到頁首"
      onClick={scrollToTop}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6.5 14.5 12 9l5.5 5.5" />
      </svg>
      <span>TOP</span>
    </button>
  );
}
