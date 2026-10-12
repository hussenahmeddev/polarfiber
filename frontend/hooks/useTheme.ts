import { useState, useEffect, useCallback } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const onStorage = (e: StorageEvent) => {
      if (e.key === "polarfiber-theme") {
        const newTheme = e.newValue === "dark" ? "dark" : "light";
        setTheme(newTheme);
        if (newTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    const onThemeChange = () => {
      const isDarkNow = document.documentElement.classList.contains("dark");
      setTheme(isDarkNow ? "dark" : "light");
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("polarfiber-theme-change", onThemeChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("polarfiber-theme-change", onThemeChange);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("polarfiber-theme", nextTheme);
    } catch {
      // ignore quota or storage errors
    }
    setTheme(nextTheme);
    window.dispatchEvent(new Event("polarfiber-theme-change"));
  }, []);

  const setThemeMode = useCallback((mode: "light" | "dark") => {
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("polarfiber-theme", mode);
    } catch {
      // ignore
    }
    setTheme(mode);
    window.dispatchEvent(new Event("polarfiber-theme-change"));
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme, setThemeMode };
}
