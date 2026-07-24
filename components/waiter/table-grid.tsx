"use client"

import type { Table, Order } from "@/lib/firebase/firestore"
import { cn } from "@/lib/utils"

interface TableGridProps {
  tables: Table[]
  onTableSelect: (table: Table) => void
  readyOrders?: Order[]
}

// Status mapping from English (Firestore) to Spanish (UI display)
const statusMap: Record<string, string> = {
  available: "Disponible",
  occupied: "Ocupada",
  reserved: "Reservada",
}

// Normalize status to handle any case/whitespace issues
const normalizeStatus = (status: string | undefined): string => {
  return status?.trim().toLowerCase() || "available"
}

export function TableGrid({ tables, onTableSelect, readyOrders = [] }: TableGridProps) {
  // Only show active tables
  const activeTables = tables.filter((table) => table.active)
  const sortedTables = [...activeTables].sort((a, b) => a.number - b.number)

  // Map of table IDs to ready orders count
  const readyOrdersMap = readyOrders.reduce(
    (acc, order) => {
      if (order.tableId) acc[order.tableId] = (acc[order.tableId] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
      {sortedTables.map((table) => {
        const status = normalizeStatus(table.status)
        const isAvailable = status === "available" && table.active
        const isOccupied = status === "occupied"
        const isReserved = status === "reserved"
        const hasReadyOrder = readyOrdersMap[table.id!] ? true : false

        return (
          <button
            key={table.id}
            onClick={() => onTableSelect(table)}
            className={cn(
              "aspect-square rounded-xl border-2 p-2 sm:p-4 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all hover:scale-105 active:scale-95 min-h-[80px] relative",
              isAvailable &&
                "bg-green-500/10 border-green-500/50 hover:border-green-500 hover:bg-green-500/20",
              isOccupied &&
                "bg-red-500/10 border-red-500/50 hover:border-red-500 hover:bg-red-500/20",
              isReserved &&
                "bg-yellow-500/10 border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/20"
            )}
          >
            {/* Ready Order Alert Badge */}
            {hasReadyOrder && (
              <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-full border-2 border-background flex items-center justify-center">
                <span className="text-white text-xs sm:text-sm font-bold">!</span>
              </div>
            )}
            
            <div className="relative hidden sm:block">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                  "transition-colors",
                  isAvailable && "text-green-500",
                  isOccupied && "text-red-500",
                  isReserved && "text-yellow-500"
                )}
              >
                {/* Table top */}
                <rect
                  x="6"
                  y="16"
                  width="36"
                  height="4"
                  rx="2"
                  fill="currentColor"
                />
                {/* Table legs */}
                <rect x="10" y="20" width="4" height="16" rx="1" fill="currentColor" opacity="0.7" />
                <rect x="34" y="20" width="4" height="16" rx="1" fill="currentColor" opacity="0.7" />
                {/* Chairs */}
                <circle cx="8" cy="24" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="40" cy="24" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="24" cy="8" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="24" cy="40" r="4" fill="currentColor" opacity="0.5" />
              </svg>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-xl sm:text-2xl font-bold",
                  isAvailable && "text-green-500",
                  isOccupied && "text-red-500",
                  isReserved && "text-yellow-500"
                )}
              >
                {table.number}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {statusMap[status] || status}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
