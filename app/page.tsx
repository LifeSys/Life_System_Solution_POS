"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { getAllStores, getStoresByUser, type Store } from "@/lib/firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Shield, MapPin, ArrowLeft, LogIn } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const { 
    isFirebaseAuthenticated,
    firebaseLogin,
    firebaseAccessibleStores,
    login, 
    loginSuperAdmin, 
    selectStore, 
    isLoading, 
    error, 
    user, 
    needsStoreSelection, 
    availableStores,
    store 
  } = useAuth()
  
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreCode, setSelectedStoreCode] = useState("")
  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loadingStores, setLoadingStores] = useState(true)
  const [loginMode, setLoginMode] = useState<"normal" | "super_admin">("normal")

  // Load stores - initially empty, will be populated after PIN login
  useEffect(() => {
    // Don't load stores yet - wait for PIN login first
    // After PIN login, user will be available, then we filter stores
    setLoadingStores(false)
  }, [])
  
  // After Firebase auth, load stores accessible via firebaseUid/firebaseEmail
  useEffect(() => {
    if (firebaseAccessibleStores.length > 0) {
      setStores(firebaseAccessibleStores)
      
      // If only 1 store, auto-select it for PIN login
      if (firebaseAccessibleStores.length === 1) {
        setSelectedStoreCode(firebaseAccessibleStores[0].code)
      }
    }
  }, [firebaseAccessibleStores])
  
  // After user logs in with PIN, filter stores based on user's access
  useEffect(() => {
    if (user && loginMode === "normal") {
      async function loadUserStores() {
        try {
          const userStores = await getStoresByUser(user)
          setStores(userStores)
        } catch (err) {
          console.error("Error loading user stores:", err)
          setStores([])
        }
      }
      loadUserStores()
    }
  }, [user, loginMode])

  // Redirect when user is logged in and has selected a store
  useEffect(() => {
    if (user && store && !needsStoreSelection) {
      switch (user.role) {
        case "super_admin":
        case "admin":
          router.push("/admin")
          break
        case "mesero":
          router.push("/mesero")
          break
        case "cocina":
          router.push("/cocina")
          break
        case "cajero":
          router.push("/caja")
          break
        default:
          router.push("/mesero")
      }
    }
  }, [user, store, needsStoreSelection, router])

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit)
    }
  }

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1))
  }

  const handlePinClear = () => {
    setPin("")
  }

  const handleFirebaseLogin = async () => {
    if (!email || !password) return
    const success = await firebaseLogin(email, password)
    if (success) {
      setEmail("")
      setPassword("")
      // Firebase login succeeded, Firebase auth state will update automatically
    }
  }

  const handlePinLogin = async () => {
    if (loginMode === "super_admin") {
      if (pin.length < 4) return
      const success = await loginSuperAdmin(pin)
      if (!success) {
        setPin("")
      }
    } else {
      if (!selectedStoreCode || pin.length < 4) return
      const success = await login(selectedStoreCode, pin)
      if (!success) {
        setPin("")
      }
    }
  }

  const handleStoreSelect = (selectedStore: Store) => {
    selectStore(selectedStore)
  }

  if (loadingStores) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  // STEP 1: Firebase Auth - Show if NOT authenticated
  if (!isFirebaseAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LOGO-mA4EhGhBGEPhESRU3bt9HPH96owwcV.png"
              alt="MultiPizza Logo"
              width={280}
              height={140}
              className="object-contain"
              priority
            />
          </div>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <LogIn className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Iniciar Sesión
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Autenticación Principal del Dispositivo
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  placeholder="admin@multipizza.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleFirebaseLogin()
                  }}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <Button
                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleFirebaseLogin}
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-5 w-5" />
                    Autenticando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Esta autenticación persiste entre reinicios del navegador
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            MultiPizza POS v1.0 - Sistema de Punto de Venta
          </p>
        </div>
      </main>
    )
  }

  // Show store selector for super_admin after PIN login
  if (needsStoreSelection && user?.role === "super_admin") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-8">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LOGO-mA4EhGhBGEPhESRU3bt9HPH96owwcV.png"
              alt="MultiPizza Logo"
              width={280}
              height={140}
              className="object-contain"
              priority
            />
          </div>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-primary">Super Administrador</span>
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Seleccionar Local
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Bienvenido, {user.name}. Selecciona el local que deseas administrar.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 max-h-80 overflow-y-auto pr-2">
                {availableStores.map((storeItem) => (
                  <Button
                    key={storeItem.id}
                    variant="outline"
                    className="h-auto py-4 px-4 flex items-center justify-between bg-muted/30 hover:bg-primary/10 hover:border-primary/50 border-border transition-all"
                    onClick={() => handleStoreSelect(storeItem)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{storeItem.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Código: {storeItem.code}
                        </p>
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
                  </Button>
                ))}
              </div>

              {availableStores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay locales disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            MultiPizza POS v1.0 - Sistema de Punto de Venta
          </p>
        </div>
      </main>
    )
  }

  // STEP 2: PIN Login - Show if Firebase authenticated but NO operational user selected
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LOGO-mA4EhGhBGEPhESRU3bt9HPH96owwcV.png"
            alt="MultiPizza Logo"
            width={280}
            height={140}
            className="object-contain"
            priority
          />
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-foreground">
              Desbloqueo Operativo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ingresa tu PIN para acceder
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Login Mode Tabs */}
            <Tabs value={loginMode} onValueChange={(v) => { setLoginMode(v as "normal" | "super_admin"); setPin("") }}>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="normal" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Usuario</span>
                </TabsTrigger>
                <TabsTrigger value="super_admin" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Super Admin</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Store Selection - Only for normal users */}
            {loginMode === "normal" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Seleccionar Local
                </label>
                <Select value={selectedStoreCode} onValueChange={setSelectedStoreCode}>
                  <SelectTrigger className="w-full bg-input border-border">
                    <SelectValue placeholder="Selecciona tu local" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((storeItem) => (
                      <SelectItem key={storeItem.id} value={storeItem.code}>
                        {storeItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Super Admin Info */}
            {loginMode === "super_admin" && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-primary text-center">
                  Ingresa tu PIN de super administrador para acceder a todos los locales
                </p>
              </div>
            )}

            {/* PIN Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Ingresa tu PIN
              </label>
              <input
                type="password"
                value={pin}
                readOnly
                placeholder="****"
                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-12 sm:h-14 text-lg sm:text-xl font-semibold bg-muted/50 hover:bg-muted border-border"
                  onClick={() => handlePinInput(digit.toString())}
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-12 sm:h-14 text-xs sm:text-sm font-medium bg-destructive/10 hover:bg-destructive/20 border-destructive/30 text-destructive"
                onClick={handlePinClear}
              >
                Limpiar
              </Button>
              <Button
                variant="outline"
                className="h-12 sm:h-14 text-lg sm:text-xl font-semibold bg-muted/50 hover:bg-muted border-border"
                onClick={() => handlePinInput("0")}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-12 sm:h-14 text-xs sm:text-sm font-medium bg-secondary/20 hover:bg-secondary/30 border-secondary/50 text-secondary"
                onClick={handlePinDelete}
              >
                Borrar
              </Button>
            </div>

            {/* Login Button */}
            <Button
              className="w-full h-11 sm:h-12 text-base sm:text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handlePinLogin}
              disabled={isLoading || (loginMode === "normal" && !selectedStoreCode) || pin.length < 4}
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-5 w-5" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          MultiPizza POS v1.0 - Sistema de Punto de Venta
        </p>
      </div>
    </main>
  )
}
