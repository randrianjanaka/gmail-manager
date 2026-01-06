'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface FilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  query?: string;
  negated_query?: string;
  has_attachment?: boolean;
  size?: number;
  size_operator?: string; 
}

export interface FilterAction {
  addLabelIds: string[];
  removeLabelIds: string[];
  forward?: string;
}

export interface FilterData {
  id?: string;
  criteria: FilterCriteria;
  action: FilterAction;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filter: FilterData) => Promise<void>;
  initialData?: FilterData;
  allLabels: any[]; // Pass all labels for selection
}

export default function FilterModal({ isOpen, onClose, onSave, initialData, allLabels }: FilterModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [criteria, setCriteria] = useState<FilterCriteria>({})
  const [action, setAction] = useState<FilterAction>({ addLabelIds: [], removeLabelIds: [] })
  
  // UI State
  const [labelSearch, setLabelSearch] = useState('');
  
  // High-level action states for UI
  const [markRead, setMarkRead] = useState(false);
  const [archive, setArchive] = useState(false);
  const [star, setStar] = useState(false);
  const [applyLabels, setApplyLabels] = useState<string[]>([]); // Multi-label selection
  
  useEffect(() => {
    setError(null); // Clear error on open/data change
    if (initialData) {
      setCriteria(initialData.criteria || {});
      const act = initialData.action || { addLabelIds: [], removeLabelIds: [] };
      setAction(act);
      
      // Parse actions back to UI flags
      setMarkRead(act.removeLabelIds?.includes('UNREAD') || false);
      setArchive(act.removeLabelIds?.includes('INBOX') || false);
      setStar(act.addLabelIds?.includes('STARRED') || false);
      
      // Find ALL user labels from initialData
      const userLabels = act.addLabelIds?.filter(id => allLabels.some(l => l.id === id && l.type === 'user')) || [];
      setApplyLabels(userLabels);
    } else {
      // Reset
      setCriteria({});
      setAction({ addLabelIds: [], removeLabelIds: [] });
      setMarkRead(false);
      setArchive(false);
      setStar(false);
      setApplyLabels([]);
    }
  }, [initialData, isOpen, allLabels]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate: at least one criterion or action must be provided
    const hasCriteria = criteria.from || criteria.to || criteria.subject || criteria.query || criteria.negated_query || criteria.has_attachment;
    const hasAction = markRead || archive || star || applyLabels.length > 0;
    
    if (!hasCriteria) {
      setError('Please specify at least one search criterion (From, To, Subject, etc.)');
      return;
    }
    
    if (!hasAction) {
      setError('Please specify at least one action (Mark as read, Archive, Star, or Apply a label).');
      return;
    }
    
    setLoading(true);
    
    // Construct final action object
    const finalAddLabels = [...(action.addLabelIds || [])].filter(l => l !== 'STARRED' && !allLabels.some(ul => ul.id === l && ul.type === 'user'));
    const finalRemoveLabels = [...(action.removeLabelIds || [])].filter(l => l !== 'UNREAD' && l !== 'INBOX');

    if (markRead) finalRemoveLabels.push('UNREAD');
    if (archive) finalRemoveLabels.push('INBOX');
    if (star) finalAddLabels.push('STARRED');
    // Add all selected labels
    applyLabels.forEach(labelId => {
      if (!finalAddLabels.includes(labelId)) finalAddLabels.push(labelId);
    });
    
    const filterData: FilterData = {
      id: initialData?.id,
      criteria,
      action: {
        addLabelIds: finalAddLabels,
        removeLabelIds: finalRemoveLabels,
        forward: action.forward
      }
    };

    try {
      await onSave(filterData);
      onClose();
    } catch (error: any) {
      console.error("Failed to save filter", error);
      setError(error?.message || 'Failed to save filter. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full flex flex-col max-h-[90vh] shadow-xl">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">
            {initialData ? 'Edit Filter' : 'Create Filter'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="filter-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Criteria Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search Criteria</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From</Label>
                  <Input 
                    id="from" 
                    placeholder="sender@example.com" 
                    value={criteria.from || ''}
                    onChange={e => setCriteria({...criteria, from: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">To</Label>
                  <Input 
                    id="to" 
                    placeholder="recipient@example.com" 
                    value={criteria.to || ''}
                    onChange={e => setCriteria({...criteria, to: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    placeholder="Email subject" 
                    value={criteria.subject || ''}
                    onChange={e => setCriteria({...criteria, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="query">Has the words</Label>
                  <Input 
                    id="query" 
                    placeholder="keywords" 
                    value={criteria.query || ''}
                    onChange={e => setCriteria({...criteria, query: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="negated">Doesn't have</Label>
                  <Input 
                    id="negated" 
                    placeholder="excluded words" 
                    value={criteria.negated_query || ''}
                    onChange={e => setCriteria({...criteria, negated_query: e.target.value})}
                  />
                </div>
                
                <div className="flex items-center space-x-2 md:col-span-2">
                  <Checkbox 
                    id="has-attachment" 
                    checked={criteria.has_attachment || false}
                    onCheckedChange={(checked) => setCriteria({...criteria, has_attachment: checked as boolean})}
                  />
                  <Label htmlFor="has-attachment">Has attachment</Label>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Actions Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="mark-read" 
                        checked={markRead}
                        onCheckedChange={(c) => setMarkRead(!!c)}
                    />
                    <Label htmlFor="mark-read">Mark as read</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="archive" 
                        checked={archive}
                        onCheckedChange={(c) => setArchive(!!c)}
                    />
                    <Label htmlFor="archive">Skip the Inbox (Archive it)</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="star" 
                        checked={star}
                        onCheckedChange={(c) => setStar(!!c)}
                    />
                    <Label htmlFor="star">Star it</Label>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <Label>Apply labels:</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search labels..."
                            value={labelSearch}
                            onChange={(e) => setLabelSearch(e.target.value)}
                            className="pl-9 mb-2"
                        />
                    </div>
                    {allLabels.filter(l => l.type === 'user' && l.name.toLowerCase().includes(labelSearch.toLowerCase())).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching labels found.</p>
                    ) : (
                      <ScrollArea className="h-32 w-full rounded-md border p-3">
                        <div className="space-y-2">
                          {allLabels
                            .filter(l => l.type === 'user' && l.name.toLowerCase().includes(labelSearch.toLowerCase()))
                            .map(label => (
                            <div key={label.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`label-${label.id}`}
                                checked={applyLabels.includes(label.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setApplyLabels([...applyLabels, label.id]);
                                  } else {
                                    setApplyLabels(applyLabels.filter(id => id !== label.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`label-${label.id}`} className="font-normal cursor-pointer">
                                {label.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-muted/20">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="filter-form" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Update Filter' : 'Create Filter'}
          </Button>
        </div>
      </div>
    </div>
  )
}
