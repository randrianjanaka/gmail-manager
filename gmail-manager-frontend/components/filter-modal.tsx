'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [criteria, setCriteria] = useState<FilterCriteria>({})
  const [action, setAction] = useState<FilterAction>({ addLabelIds: [], removeLabelIds: [] })
  
  // High-level action states for UI
  const [markRead, setMarkRead] = useState(false);
  const [archive, setArchive] = useState(false);
  const [star, setStar] = useState(false);
  const [applyLabel, setApplyLabel] = useState<string>(''); // Single label selection for simplicity initially, or multi?
  
  useEffect(() => {
    if (initialData) {
      setCriteria(initialData.criteria || {});
      const act = initialData.action || { addLabelIds: [], removeLabelIds: [] };
      setAction(act);
      
      // Parse actions back to UI flags
      setMarkRead(act.removeLabelIds?.includes('UNREAD') || false);
      setArchive(act.removeLabelIds?.includes('INBOX') || false);
      setStar(act.addLabelIds?.includes('STARRED') || false);
      
      // Find a user label if any
      const userLabel = act.addLabelIds?.find(id => allLabels.some(l => l.id === id && l.type === 'user'));
      if (userLabel) setApplyLabel(userLabel);
    } else {
      // Reset
      setCriteria({});
      setAction({ addLabelIds: [], removeLabelIds: [] });
      setMarkRead(false);
      setArchive(false);
      setStar(false);
      setApplyLabel('');
    }
  }, [initialData, isOpen, allLabels]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Construct final action object
    const finalAddLabels = [...(action.addLabelIds || [])].filter(l => l !== 'STARRED' && !allLabels.some(ul => ul.id === l && ul.type === 'user'));
    const finalRemoveLabels = [...(action.removeLabelIds || [])].filter(l => l !== 'UNREAD' && l !== 'INBOX');

    if (markRead) finalRemoveLabels.push('UNREAD');
    if (archive) finalRemoveLabels.push('INBOX');
    if (star) finalAddLabels.push('STARRED');
    if (applyLabel && applyLabel !== 'no_label_value') finalAddLabels.push(applyLabel);
    
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
    } catch (error) {
      console.error("Failed to save filter", error);
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

        <div className="p-6 overflow-y-auto flex-1">
          <form id="filter-form" onSubmit={handleSubmit} className="space-y-6">
            
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label>Apply the label:</Label>
                        <Select 
                            value={applyLabel} 
                            onValueChange={setApplyLabel}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose label..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no_label_value">Choose label...</SelectItem>
                                {allLabels.filter(l => l.type === 'user').map(label => (
                                    <SelectItem key={label.id} value={label.id}>{label.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
