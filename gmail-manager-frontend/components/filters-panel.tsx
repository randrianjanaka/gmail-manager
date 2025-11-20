'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface FilterValues {
  from_sender?: string
  to_recipient?: string
  subject?: string
  after_date?: string
  before_date?: string
}

interface FiltersPanelProps {
  onApplyFilters: (filters: FilterValues) => void
}

export default function FiltersPanel({ onApplyFilters }: FiltersPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterValues>({})

  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  const handleSearch = () => {
    onApplyFilters(filters)
  }

  const handleClear = () => {
    setFilters({})
    onApplyFilters({})
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="mb-6 bg-card border border-border rounded-lg overflow-hidden relative z-20">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">Filters</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-border p-6 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                From
              </label>
              <Input
                type="email"
                placeholder="sender@example.com"
                value={filters.from_sender || ''}
                onChange={(e) =>
                  handleFilterChange('from_sender', e.target.value)
                }
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                To
              </label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={filters.to_recipient || ''}
                onChange={(e) =>
                  handleFilterChange('to_recipient', e.target.value)
                }
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Subject
              </label>
              <Input
                type="text"
                placeholder="Search subjects..."
                value={filters.subject || ''}
                onChange={(e) =>
                  handleFilterChange('subject', e.target.value)
                }
                onKeyDown={handleKeyDown}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                After
              </label>
              <Input
                type="date"
                value={filters.after_date || ''}
                onChange={(e) =>
                  handleFilterChange('after_date', e.target.value)
                }
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                Before
              </label>
              <Input
                type="date"
                value={filters.before_date || ''}
                onChange={(e) =>
                  handleFilterChange('before_date', e.target.value)
                }
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClear}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </Button>
            <Button size="sm" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}