import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  // For now we ignore actual theming and just render children.
  return <>{children}</>;
}

export default ThemeProvider;
