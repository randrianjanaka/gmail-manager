'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationControlsProps {
  totalEstimate: number
  currentStart: number
  currentEnd: number
  hasNextPage: boolean
  hasPrevPage: boolean
  onNext: () => void
  onPrev: () => void
  loading?: boolean
  itemsPerPage: number
  onItemsPerPageChange: (value: number) => void
  currentPageIndex: number
  onJumpToPage: (page: number) => void
}

export default function PaginationControls({
  totalEstimate,
  currentStart,
  currentEnd,
  hasNextPage,
  hasPrevPage,
  onNext,
  onPrev,
  loading = false,
  itemsPerPage,
  onItemsPerPageChange,
  currentPageIndex,
  onJumpToPage,
}: PaginationControlsProps) {
  
  const totalPages = Math.ceil(totalEstimate / itemsPerPage);
  const [jumpPage, setJumpPage] = useState(String(currentPageIndex + 1));

  useEffect(() => {
    setJumpPage(String(currentPageIndex + 1));
  }, [currentPageIndex]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onJumpToPage(page - 1); // Convert to 0-index
    }
  };

  return (
    <div className="mt-6 p-4 bg-card border border-border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Showing {currentStart}-{currentEnd} of ~{totalEstimate.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue placeholder="25" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      <div className="flex items-center gap-2">
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 mr-2">
          <span className="text-sm text-muted-foreground">Page</span>
          <Input 
            className="w-12 h-8 text-center p-1" 
            value={jumpPage} 
            onChange={(e) => setJumpPage(e.target.value)} 
          />
          <span className="text-sm text-muted-foreground">of {totalPages}</span>
        </form>

        <Button
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={!hasPrevPage || loading}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={!hasNextPage || loading}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}