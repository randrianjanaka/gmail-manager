'use client'

import { useState, useEffect } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

interface Label {
  id: string;
  name: string;
  type: string;
}

interface LabelModalProps {
  onClose: () => void
  onAssign: (labels: string[]) => void
  allLabels: Label[]
  loading?: boolean
}

const RECENT_LABELS_KEY = 'recent_labels';

export default function LabelModal({ onClose, onAssign, allLabels = [], loading = false }: LabelModalProps) {
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [recentLabels, setRecentLabels] = useState<string[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading]);

  useEffect(() => {
    const storedRecent = localStorage.getItem(RECENT_LABELS_KEY);
    if (storedRecent) {
      try {
        const parsed = JSON.parse(storedRecent);
        if (Array.isArray(parsed)) {
            // Filter out any labels that might have been deleted or don't exist in current list
            const validRecent = parsed.filter(name => allLabels.some(l => l.name === name));
            setRecentLabels(validRecent);
        }
      } catch (e) {
        console.error("Failed to parse recent labels", e);
      }
    }
  }, [allLabels]);

  const handleToggleLabel = (label: string) => {
    const newSelected = new Set(selectedLabels)
    if (newSelected.has(label)) {
      newSelected.delete(label)
    } else {
      newSelected.add(label)
    }
    setSelectedLabels(newSelected)
  }

  const handleAssign = () => {
    const labelsToAssign = Array.from(selectedLabels);
    
    // Update recent labels
    if (labelsToAssign.length > 0) {
        const newRecent = Array.from(new Set([...labelsToAssign, ...recentLabels])).slice(0, 5);
        setRecentLabels(newRecent);
        localStorage.setItem(RECENT_LABELS_KEY, JSON.stringify(newRecent));
    }
    
    onAssign(labelsToAssign)
  }

  const filteredLabels = allLabels.filter(l => 
      l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine recent labels objects
  const recentLabelObjects = recentLabels
    .map(name => allLabels.find(l => l.name === name))
    .filter((l): l is Label => !!l); // Type guard to remove undefined

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
      <div className="bg-card border border-border rounded-lg max-w-md w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Assign Labels</h2>
            <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                disabled={loading}
            >
                <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
             <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search labels..." 
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
             />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          
          {/* Recent Labels Section */}
          {!searchTerm && recentLabelObjects.length > 0 && (
              <div className="space-y-3 mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Recent</h3>
                   {recentLabelObjects.map((label) => (
                    <div
                    key={`recent-${label.id}`}
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => !loading && handleToggleLabel(label.name)}
                    >
                    <Checkbox
                        checked={selectedLabels.has(label.name)}
                        onCheckedChange={() => handleToggleLabel(label.name)}
                        disabled={loading}
                    />
                    <span className="text-foreground">{label.name}</span>
                    </div>
                ))}
                <div className="h-px bg-border my-2" />
              </div>
          )}

          <h3 className="text-xs font-semibold text-muted-foreground uppercase">All Labels</h3>
          <div className="space-y-3">
            {filteredLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No labels found</p>
            ) : (
                filteredLabels.map((label) => (
                    <div
                    key={label.id}
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => !loading && handleToggleLabel(label.name)}
                    >
                    <Checkbox
                        checked={selectedLabels.has(label.name)}
                        onCheckedChange={() => handleToggleLabel(label.name)}
                        disabled={loading}
                    />
                    <span className="text-foreground">{label.name}</span>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6 flex justify-end gap-2 shrink-0">
          <Button onClick={onClose} variant="outline" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Labels
          </Button>
        </div>
      </div>
    </div>
  )
}