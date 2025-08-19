"use client";

import { useEffect, useState } from "react";

interface DarkModeProviderProps {
  children: React.ReactNode;
}

export default function DarkModeProvider({ children }: DarkModeProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize dark mode from localStorage
    const savedDarkMode = localStorage.getItem("whiteboard_dark_mode");
    if (savedDarkMode !== null) {
      const isDark = JSON.parse(savedDarkMode);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Check system preference if no saved preference
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      if (prefersDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("whiteboard_dark_mode", "true");
      }
    }

    setIsInitialized(true);
  }, []);

  // Don't render children until dark mode is initialized to prevent flash
  if (!isInitialized) {
    return null;
  }

  return <>{children}</>;
}
