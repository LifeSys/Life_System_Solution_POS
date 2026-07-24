"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { auth } from "@/lib/firebase/config"
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth"
import { getUserByPinAndStore, getUserByPin, getStoreByCode, getAllStores, getUserAccessibleStores, getStoresAccessibleByUser, getStoresByFirebaseCredentials, getDocument, type User, type Store } from "@/lib/firebase/firestore"
import { 
  hasPermission, 
  canAccessStore, 
  canAccessAdminPanel, 
  canManageUsers,
  canProcessPayments,
  canCreateOrders,
  canViewKitchen,
  canManageKitchen,
  type Permission
} from "@/lib/auth/permissions"

interface AuthContextType {
  // Firebase Auth state (persistent across refreshes)
  firebaseUser: FirebaseUser | null
  isFirebaseAuthenticated: boolean
  firebaseLogin: (email: string, password: string) => Promise<boolean>
  firebaseLogout: () => Promise<void>
  
  // PIN-based operational user
  user: User | null
  store: Store | null
  currentStore: Store | null
  storeId: string | null
  currentStoreId: string | null
  availableStores: Store[]
  allAccessibleStores: Store[] // All stores user can access (for admin_global)
  firebaseAccessibleStores: Store[] // Stores accessible via Firebase auth (firebaseUid/firebaseEmail)
  
  // UI State
  isLoading: boolean
  error: string | null
  needsStoreSelection: boolean
  
  // PIN login functions
  login: (storeCode: string, pin: string) => Promise<boolean>
  loginSuperAdmin: (pin: string) => Promise<boolean>
  selectStore: (store: Store) => void
  changeStore: () => void
  switchStore: (store: Store) => Promise<void> // Switch to different store (for admin_global)
  logout: () => Promise<void>
  
  // Role checks (legacy - still supported)
  isSuperAdmin: boolean
  isAdmin: boolean
  isCajero: boolean
  isMesero: boolean
  isCocina: boolean
  
  // Permission helpers
  hasPermission: (permission: Permission) => boolean
  canAccessStore: (storeId: string) => boolean
  canAccessAdminPanel: () => boolean
  canManageUsers: () => boolean
  canProcessPayments: () => boolean
  canCreateOrders: () => boolean
  canViewKitchen: () => boolean
  canManageKitchen: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Firebase Auth state (persisted by Firebase)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false)
  
  // PIN-based user
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)
  const [availableStores, setAvailableStores] = useState<Store[]>([])
  const [allAccessibleStores, setAllAccessibleStores] = useState<Store[]>([])
  const [firebaseAccessibleStores, setFirebaseAccessibleStores] = useState<Store[]>([])
  
  // UI State
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsStoreSelection, setNeedsStoreSelection] = useState(false)

  // Set up Firebase Auth listener - runs once on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser)
        setIsFirebaseAuthenticated(true)
        
        // Load stores accessible by this user
        try {
          const stores = await getStoresByFirebaseCredentials(fbUser.uid, fbUser.email || undefined)
          setFirebaseAccessibleStores(stores)
          
          // If only one store, auto-select it
          if (stores.length === 1) {
            setStore(stores[0])
            setCurrentStoreId(stores[0].id!)
          }
        } catch (err) {
          console.error("Error loading Firebase stores:", err)
        }

        // IMPORTANT: Try to restore PIN validation from localStorage
        // This allows users to stay logged in after refresh/F5
        try {
          const pinData = localStorage.getItem("pos_operative_unlock")
          if (pinData) {
            const parsed = JSON.parse(pinData)
            
            // Validate Firebase UID matches (prevent using PIN from different user)
            if (parsed.firebaseUid !== fbUser.uid) {
              console.log("[v0] Firebase UID mismatch - clearing PIN persistence")
              localStorage.removeItem("pos_operative_unlock")
              return
            }

            // Validate not expired
            if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
              console.log("[v0] PIN validation expired - clearing localStorage")
              localStorage.removeItem("pos_operative_unlock")
              return
            }

            // Restore user and store from localStorage + validate in Firestore
            try {
              // Load user by ID from Firestore
              const restoredUser = await getDocument<User>("users", parsed.userId)
              
              // If user still exists and is active, restore state
              if (restoredUser && restoredUser.active) {
                // Load the store list
                const storeList = await getStoresByFirebaseCredentials(fbUser.uid, fbUser.email || undefined)
                const selectedStore = storeList.find(s => s.id === parsed.storeId)
                
                if (selectedStore) {
                  setUser(restoredUser)
                  setStore(selectedStore)
                  setCurrentStoreId(selectedStore.id!)
                  setNeedsStoreSelection(false)
                  console.log("[v0] Restored PIN validation from localStorage for user:", restoredUser.name)
                  return
                }
              }

              // If restoration failed, clear localStorage
              localStorage.removeItem("pos_operative_unlock")
            } catch (err) {
              console.warn("[v0] Error restoring user from PIN data:", err)
              localStorage.removeItem("pos_operative_unlock")
            }
          }
        } catch (err) {
          console.warn("[v0] Error processing PIN persistence:", err)
        }
      } else {
        // Firebase auth expired or user signed out - clear all
        setFirebaseUser(null)
        setIsFirebaseAuthenticated(false)
        setFirebaseAccessibleStores([])
        setUser(null)
        setStore(null)
        setCurrentStoreId(null)
        localStorage.removeItem("pos_operative_unlock")
      }
    })

    return () => unsubscribe()
  }, [])

  const firebaseLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (err: any) {
      console.error("Firebase login error:", err)
      setError(err.message || "Error al iniciar sesión")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // PIN login for normal users (existing system)
  const login = useCallback(async (storeCode: string, pin: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const foundStore = await getStoreByCode(storeCode.toUpperCase())
      if (!foundStore) {
        setError("Código de tienda inválido")
        return false
      }

      if (!foundStore.active) {
        setError("Esta tienda no está activa")
        return false
      }

      // Get user by PIN and store
      let foundUser = await getUserByPinAndStore(pin, foundStore.id!)
      if (!foundUser) {
        setError("PIN incorrecto o usuario inactivo en esta tienda")
        return false
      }

      // CRITICAL: Validate user has access to this store
      // For single-store users: check storeId
      // For multi-store users (admin_global): check assignedStores
      const hasAccess = 
        (foundUser.role === "admin_global" && foundUser.assignedStores?.includes(foundStore.id!)) ||
        (foundUser.storeId === foundStore.id!)

      if (!hasAccess) {
        setError("Acceso denegado: usuario no está autorizado para esta tienda")
        console.error(
          `[v0] Access denied - User ${foundUser.name} (${foundUser.id}) ` +
          `not assigned to store ${foundStore.code} (${foundStore.id}). ` +
          `Role: ${foundUser.role}, StoreID: ${foundUser.storeId}, AssignedStores: ${foundUser.assignedStores?.join(',') || 'none'}`
        )
        return false
      }

      setStore(foundStore)
      setCurrentStoreId(foundStore.id!)
      setUser(foundUser)
      setNeedsStoreSelection(false)
      
      // Persist PIN validation to localStorage for F5/refresh
      if (firebaseUser) {
        const pinData = {
          userId: foundUser.id!,
          storeId: foundStore.id!,
          userName: foundUser.name,
          firebaseUid: firebaseUser.uid,
          timestamp: Date.now(),
          expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
        }
        localStorage.setItem("pos_operative_unlock", JSON.stringify(pinData))
      }
      
      return true
    } catch (err) {
      console.error("PIN login error:", err)
      setError("Error al iniciar sesión. Intente de nuevo.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [firebaseUser])

  // PIN login for super admin (existing system)
  const loginSuperAdmin = useCallback(async (pin: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const foundUser = await getUserByPin(pin)
      if (!foundUser) {
        setError("PIN incorrecto o usuario inactivo")
        return false
      }

      if (foundUser.role !== "super_admin" && foundUser.role !== "admin_global") {
        setError("Este PIN no corresponde a un administrador")
        return false
      }

      const stores = await getAllStores()
      setAvailableStores(stores)
      
      // For admin_global, also load all accessible stores
      if (foundUser.role === "admin_global") {
        const accessibleStores = await getUserAccessibleStores(foundUser.id!)
        setAllAccessibleStores(accessibleStores)
      }
      
      setUser(foundUser)
      setNeedsStoreSelection(true)
      
      return true
    } catch (err) {
      console.error("Super admin PIN login error:", err)
      setError("Error al iniciar sesión. Intente de nuevo.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Select store for super admin
  const selectStore = useCallback((selectedStore: Store) => {
    setStore(selectedStore)
    setCurrentStoreId(selectedStore.id!)
    setNeedsStoreSelection(false)
  }, [])

  // Unlock session with PIN (used on /unlock page after session lock or refresh)
  // Change store for super admin
  const changeStore = useCallback(() => {
    setStore(null)
    setCurrentStoreId(null)
    setNeedsStoreSelection(true)
  }, [])

  // Switch to different store (for admin_global users)
  const switchStore = useCallback(async (selectedStore: Store) => {
    try {
      setStore(selectedStore)
      setCurrentStoreId(selectedStore.id!)
      setNeedsStoreSelection(false)
    } catch (err) {
      console.error("Error switching store:", err)
      setError("Error al cambiar de local")
    }
  }, [])

  // Complete logout (Firebase + operational)
  const logout = useCallback(async () => {
    try {
      await signOut(auth)
      setUser(null)
      setStore(null)
      setCurrentStoreId(null)
      setAvailableStores([])
      setAllAccessibleStores([])
      setFirebaseAccessibleStores([])
      setError(null)
      setNeedsStoreSelection(false)
      localStorage.removeItem("pos_operative_unlock")
    } catch (err) {
      console.error("Logout error:", err)
      setError("Error al cerrar sesión")
    }
  }, [])

  const value: AuthContextType = {
    firebaseUser,
    isFirebaseAuthenticated,
    firebaseLogin,
    firebaseLogout: logout,
    
    user,
    store,
    currentStore: store,
    storeId: currentStoreId,
    currentStoreId,
    availableStores,
    allAccessibleStores,
    firebaseAccessibleStores,
    
    isLoading,
    error,
    needsStoreSelection,
    
    login,
    loginSuperAdmin,
    selectStore,
    changeStore,
    switchStore,
    logout,
    
    // Legacy role checks - still supported
    isSuperAdmin: user?.role === "super_admin",
    isAdmin: user?.role === "admin" || user?.role === "admin_global" || user?.role === "super_admin",
    isCajero: user?.role === "cajero" || user?.role === "admin" || user?.role === "admin_global" || user?.role === "super_admin",
    isMesero: user?.role === "mesero" || user?.role === "admin" || user?.role === "admin_global" || user?.role === "super_admin",
    isCocina: user?.role === "cocina" || user?.role === "admin" || user?.role === "admin_global" || user?.role === "super_admin",
    
    // Permission helpers
    hasPermission: (permission: Permission) => hasPermission(user, permission),
    canAccessStore: (storeId: string) => canAccessStore(user, storeId),
    canAccessAdminPanel: () => canAccessAdminPanel(user),
    canManageUsers: () => canManageUsers(user),
    canProcessPayments: () => canProcessPayments(user),
    canCreateOrders: () => canCreateOrders(user),
    canViewKitchen: () => canViewKitchen(user),
    canManageKitchen: () => canManageKitchen(user),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
