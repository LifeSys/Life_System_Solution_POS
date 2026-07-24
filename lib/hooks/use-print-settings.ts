/**
 * Hook for managing print settings
 * Handles localStorage and Firebase persistence
 */

import { useCallback, useEffect, useState } from "react"
import { PrintSettings, DEFAULT_PRINT_SETTINGS, mergePrintSettings } from "@/lib/print/print-settings"

const STORAGE_KEY_PREFIX = "print-settings-"

/**
 * Get storage key for a specific store
 */
function getStorageKey(storeId: string): string {
  return `${STORAGE_KEY_PREFIX}${storeId}`
}

/**
 * Hook to manage print settings
 */
export function usePrintSettings(storeId: string) {
  const [settings, setSettings] = useState<PrintSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const storageKey = getStorageKey(storeId)
        const stored = localStorage.getItem(storageKey)

        if (stored) {
          try {
            const parsed = JSON.parse(stored) as PrintSettings
            setSettings(parsed)
          } catch (e) {
            console.error("Error parsing stored settings:", e)
            // Fall back to defaults
            const defaults = mergePrintSettings({ storeId }, DEFAULT_PRINT_SETTINGS)
            setSettings(defaults)
          }
        } else {
          // Use defaults if nothing stored
          const defaults = mergePrintSettings({ storeId }, DEFAULT_PRINT_SETTINGS)
          setSettings(defaults)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error"
        setError(message)
        console.error("Error loading print settings:", e)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [storeId])

  // Save settings to localStorage
  const saveSettings = useCallback(
    async (newSettings: PrintSettings) => {
      try {
        const storageKey = getStorageKey(storeId)
        localStorage.setItem(storageKey, JSON.stringify(newSettings))
        setSettings(newSettings)
        setError(null)
        return newSettings
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error saving settings"
        setError(message)
        console.error("Error saving print settings:", e)
        throw new Error(message)
      }
    },
    [storeId]
  )

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    const defaults = mergePrintSettings({ storeId }, DEFAULT_PRINT_SETTINGS)
    await saveSettings(defaults)
  }, [storeId, saveSettings])

  // Get a specific setting value
  const getSetting = useCallback(
    <K extends keyof PrintSettings>(key: K): PrintSettings[K] | undefined => {
      return settings?.[key]
    },
    [settings]
  )

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    resetToDefaults,
    getSetting,
  }
}

/**
 * Hook to use print settings across the app
 * Provides current settings without needing to pass them through props
 */
export function useCurrentPrintSettings() {
  const [allSettings, setAllSettings] = useState<Record<string, PrintSettings>>({})

  // Get settings for a specific store (from global context)
  const getSettingsForStore = useCallback(
    (storeId: string): PrintSettings => {
      if (allSettings[storeId]) {
        return allSettings[storeId]
      }

      // Load from localStorage as fallback
      const storageKey = getStorageKey(storeId)
      const stored = localStorage.getItem(storageKey)

      if (stored) {
        try {
          return JSON.parse(stored) as PrintSettings
        } catch {
          // Fall back to defaults
          return mergePrintSettings({ storeId }, DEFAULT_PRINT_SETTINGS)
        }
      }

      return mergePrintSettings({ storeId }, DEFAULT_PRINT_SETTINGS)
    },
    [allSettings]
  )

  // Cache settings for a store
  const cacheSettings = useCallback((storeId: string, settings: PrintSettings) => {
    setAllSettings((prev) => ({
      ...prev,
      [storeId]: settings,
    }))
  }, [])

  return { getSettingsForStore, cacheSettings }
}
