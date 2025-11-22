'use client'

import { useState, useEffect } from 'react'
import { Folder, ChevronDown, ChevronRight, Tag, Loader2 } from 'lucide-react'

interface Selection {
  type: 'folder' | 'label';
  name: string;
  subfolder?: string;
}

interface Label {
    id: string;
    name: string;
    type: 'system' | 'user';
}

interface FolderNavProps {
  selection: Selection;
  onSelectFolder: (folder: string, subfolder?: string) => void
  onSelectLabel: (label: string) => void
  labels: Label[]
  loading: boolean
}

const SYSTEM_FOLDERS_ORDER = ['INBOX', 'SENT', 'SPAM', 'TRASH'];
const INBOX_SUBCATEGORIES = ['Primary', 'Promotions', 'Social'];

export default function FolderNav({ selection, onSelectFolder, onSelectLabel, labels, loading }: FolderNavProps) {
  const [expandedInbox, setExpandedInbox] = useState(true);

  const systemLabels = labels.filter(l => l.type === 'system' && SYSTEM_FOLDERS_ORDER.includes(l.name))
                             .sort((a, b) => SYSTEM_FOLDERS_ORDER.indexOf(a.name) - SYSTEM_FOLDERS_ORDER.indexOf(b.name));
  const userLabels = labels.filter(l => l.type === 'user');

  const isActive = (type: 'folder' | 'label' | 'subfolder', name: string, subfolder?: string) => {
    if (type === 'subfolder') {
      return selection.type === 'folder' && selection.name === name && selection.subfolder === subfolder;
    }
    return selection.type === type && selection.name === name && !selection.subfolder;
  };

  return (
    <div className="p-4 border-t border-border">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-3">Folders</h3>
      <nav className="space-y-1 mb-6">
        {loading ? <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin"/></div> :
        systemLabels.map((label) => {
          if (label.name === 'INBOX') {
            return (
              <div key={label.id}>
                <button onClick={() => onSelectFolder(label.name, 'Primary')} className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] md:min-h-0 ${isActive('folder', 'INBOX') ? 'bg-muted' : 'text-foreground hover:bg-muted'}`}>
                  <Folder className="w-4 h-4" />{label.name}
                  <button onClick={(e) => { e.stopPropagation(); setExpandedInbox(!expandedInbox) }} className="ml-auto p-2 -mr-2">
                    {expandedInbox ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </button>
                {expandedInbox && (
                  <div className="ml-6 mt-1 space-y-1 border-l border-border pl-4">
                    {INBOX_SUBCATEGORIES.map((sub) => (
                      <button key={sub} onClick={() => onSelectFolder('INBOX', sub)} className={`w-full text-left px-3 py-3 md:py-1.5 rounded-lg transition-colors text-sm min-h-[44px] md:min-h-0 ${isActive('subfolder', 'INBOX', sub) ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-muted'}`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          return (
            <button key={label.id} onClick={() => onSelectFolder(label.name)} className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] md:min-h-0 ${isActive('folder', label.name) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
              <Folder className="w-4 h-4" />{label.name}
            </button>
          )
        })}
      </nav>

      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-3">Labels</h3>
      <nav className="space-y-1">
        {loading ? <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin"/></div> :
        userLabels.map((label) => (
          <button key={label.id} onClick={() => onSelectLabel(label.name)} className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] md:min-h-0 ${isActive('label', label.name) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
            <Tag className="w-4 h-4" />{label.name}
          </button>
        ))}
      </nav>
    </div>
  )
}