"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, LayoutGrid, ChefHat, CreditCard, Settings, BarChart3, Building2, RefreshCw, Moon, Sun, Package, Receipt } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

interface POSHeaderProps {
  title: string
}

export function POSHeader({ title }: POSHeaderProps) {
  const { user, store, logout, isAdmin, isSuperAdmin, isCajero, isMesero, isCocina, changeStore } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleChangeStore = () => {
    // For super_admin, go back to store selection without full logout
    changeStore()
    router.push("/")
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex-shrink-0 h-10 sm:h-12 w-24 sm:w-32 overflow-hidden flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LOGO-mA4EhGhBGEPhESRU3bt9HPH96owwcV.png"
              alt="MultiPizza"
              width={128}
              height={48}
              className="h-full w-auto object-contain max-h-10 sm:max-h-12"
            />
          </Link>
          <div className="h-6 sm:h-8 w-px bg-border hidden sm:block" />
          <div className="hidden sm:block">
            <h1 className="text-base sm:text-lg font-semibold text-foreground">{title}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{store?.name}</p>
              {isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs text-primary hover:text-primary/80"
                  onClick={handleChangeStore}
                  title="Cambiar local"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {isMesero && (
            <Link href="/mesero">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Mesas
              </Button>
            </Link>
          )}
          {isCocina && (
            <Link href="/cocina">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChefHat className="h-4 w-4" />
                Cocina
              </Button>
            </Link>
          )}
          {isCajero && (
            <Link href="/caja">
              <Button variant="ghost" size="sm" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Caja
              </Button>
            </Link>
          )}
          {isAdmin && (
            <>
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
              <Link href="/inventario">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Package className="h-4 w-4" />
                  Inventario
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reportes
                </Button>
              </Link>
            </>
          )}
          {(isCajero || isAdmin) && (
            <Link href="/comprobantes">
              <Button variant="ghost" size="sm" className="gap-2">
                <Receipt className="h-4 w-4" />
                Comprobantes
              </Button>
            </Link>
          )}
        </nav>

        {/* User Menu and Theme Toggle */}
        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
              className="gap-2 h-9 w-9 sm:h-8 sm:w-auto sm:px-3"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9 sm:h-8">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role.replace("_", " ")}</p>
                {isSuperAdmin && (
                  <p className="text-xs text-primary mt-1">Acceso a todos los locales</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="md:hidden">
                {isMesero && (
                  <DropdownMenuItem asChild>
                    <Link href="/mesero" className="gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      Mesas
                    </Link>
                  </DropdownMenuItem>
                )}
                {isCocina && (
                  <DropdownMenuItem asChild>
                    <Link href="/cocina" className="gap-2">
                      <ChefHat className="h-4 w-4" />
                      Cocina
                    </Link>
                  </DropdownMenuItem>
                )}
                {isCajero && (
                  <DropdownMenuItem asChild>
                    <Link href="/caja" className="gap-2">
                      <CreditCard className="h-4 w-4" />
                      Caja
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/inventario" className="gap-2">
                        <Package className="h-4 w-4" />
                        Inventario
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Reportes
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {(isCajero || isAdmin) && (
                  <DropdownMenuItem asChild>
                    <Link href="/comprobantes" className="gap-2">
                      <Receipt className="h-4 w-4" />
                      Comprobantes
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </div>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive gap-2">
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
