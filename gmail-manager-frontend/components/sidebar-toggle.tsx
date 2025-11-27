'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SidebarToggle() {
  const { toggleSidebar, open } = useSidebar()

  return (
    <Button
      onClick={toggleSidebar}
      variant="ghost"
      size="icon"
      className="md:hidden"
      aria-label="Toggle sidebar"
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  )
}
