// components/theme-provider.tsx
"use client" // Required for ThemeProvider

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

// Re-exporting ThemeProvider from next-themes
// This allows you to customize it later if needed, but for now,
// it just passes the props through.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}