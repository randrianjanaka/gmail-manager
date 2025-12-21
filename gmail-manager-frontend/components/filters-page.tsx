'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Trash2, Edit2, Filter, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import FilterModal, { FilterData, FilterCriteria, FilterAction } from './filter-modal'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog"

const API_BASE = '/api'

interface FiltersPageProps {
  allLabels: any[];
}

export default function FiltersPage({ allLabels }: FiltersPageProps) {
  const [filters, setFilters] = useState<FilterData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingFilter, setEditingFilter] = useState<FilterData | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const { toast } = useToast()

  useEffect(() => {
    fetchFilters()
  }, [])

  const fetchFilters = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/filters`)
      if (!res.ok) throw new Error('Failed to fetch filters')
      const data = await res.json()
      setFilters(data.filters || [])
    } catch (error) {
      console.error(error)
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load filters.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFilter = async (filter: FilterData) => {
    try {
        if (filter.id) {
            // Delete old one and create new one to "update" since Gmail API doesn't support patch easily
            // Actually implementation plan says delete + create
            await fetch(`${API_BASE}/filters/${filter.id}`, { method: 'DELETE' });
            
            const res = await fetch(`${API_BASE}/filters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filter)
            });
            if (!res.ok) throw new Error("Failed to update filter");
            toast({ title: 'Success', description: 'Filter updated.' });
        } else {
            // Create
            const res = await fetch(`${API_BASE}/filters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filter)
            });
            if (!res.ok) throw new Error("Failed to create filter");
            toast({ title: 'Success', description: 'Filter created.' });
        }
        fetchFilters();
        setShowModal(false);
        setEditingFilter(undefined);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save filter.' });
        throw error; // Let modal handle loading state if needs to stay open
    }
  }

  const handleDeleteFilter = async () => {
      if (!deletingId) return;
      try {
          const res = await fetch(`${API_BASE}/filters/${deletingId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed");
          toast({ title: 'Success', description: 'Filter deleted.' });
          fetchFilters();
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete filter.' });
      } finally {
          setDeletingId(null);
      }
  }
  
  const formatCriteria = (criteria: FilterCriteria) => {
      const parts = [];
      if (criteria.from) parts.push(`From: ${criteria.from}`);
      if (criteria.to) parts.push(`To: ${criteria.to}`);
      if (criteria.subject) parts.push(`Subject: ${criteria.subject}`);
      if (criteria.query) parts.push(`Includes: ${criteria.query}`);
      if (criteria.negated_query) parts.push(`Excludes: ${criteria.negated_query}`);
      if (criteria.has_attachment) parts.push(`Has attachment`);
      
      if (parts.length === 0) return "Match all messages";
      return parts.join(", ");
  }

  const formatAction = (action: FilterAction) => {
      const parts = [];
      if (action.removeLabelIds?.includes('UNREAD')) parts.push("Mark as read");
      if (action.removeLabelIds?.includes('INBOX')) parts.push("Archive");
      if (action.addLabelIds?.includes('STARRED')) parts.push("Star it");
      
      const labels = action.addLabelIds
        ?.filter(id => id !== 'STARRED')
        .map(id => {
            const l = allLabels.find(al => al.id === id);
            return l ? l.name : id;
        });
      
      if (labels && labels.length > 0) parts.push(`Apply label: ${labels.join(', ')}`);
      
      if (parts.length === 0) return "No action";
      return parts.join(", ");
  }

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Filter className="w-8 h-8" />
                Filters
            </h1>
            <p className="text-muted-foreground mt-1">Manage your automated email filters.</p>
        </div>
        <Button onClick={() => { setEditingFilter(undefined); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Create Filter
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg flex-1 overflow-hidden flex flex-col shadow-sm">
        {loading ? (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        ) : filters.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                <div className="bg-muted p-4 rounded-full">
                    <Filter className="w-8 h-8 opacity-50" />
                </div>
                <p>No filters found. Create one to automate your inbox.</p>
                <Button variant="outline" onClick={() => setShowModal(true)}>Create First Filter</Button>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 font-medium">Criteria</th>
                            <th className="px-6 py-3 font-medium">Actions</th>
                            <th className="px-6 py-3 text-right">Options</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filters.map((filter) => (
                            <tr key={filter.id} className="bg-card hover:bg-muted/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-foreground">
                                    {formatCriteria(filter.criteria)}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {formatAction(filter.action)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => { setEditingFilter(filter); setShowModal(true); }}
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => setDeletingId(filter.id || null)}
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      <FilterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveFilter}
        initialData={editingFilter}
        allLabels={allLabels}
      />
      
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Filter?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. The filter will be permanently removed.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteFilter} className="bg-destructive hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
