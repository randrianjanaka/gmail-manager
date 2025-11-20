'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Email {
  id: string
  sender: string
  subject: string
  snippet: string
  date: string
  is_unread: boolean
}

interface EmailListProps {
  emails: Email[]
  selectedEmails: Set<string>
  onSelectEmail: (id: string) => void
  onSelectAll: () => void
  onOpenEmail: (id: string) => void
  totalEstimate: number
  onSelectAllMatching: () => void
  isAllMatchingSelected: boolean
  onClearSelection: () => void
}

export default function EmailList({
  emails,
  selectedEmails,
  onSelectEmail,
  onSelectAll,
  onOpenEmail,
  totalEstimate,
  onSelectAllMatching,
  isAllMatchingSelected,
  onClearSelection
}: EmailListProps) {
  
  const allOnPageSelected = emails.length > 0 && selectedEmails.size === emails.length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Select All Banner */}
      {allOnPageSelected && !isAllMatchingSelected && totalEstimate > emails.length && (
        <div className="bg-secondary/50 p-2 text-center text-sm border-b border-border">
          <span>All {emails.length} conversations on this page are selected. </span>
          <Button variant="link" className="h-auto p-0" onClick={onSelectAllMatching}>
            Select all {totalEstimate.toLocaleString()} conversations in this folder
          </Button>
        </div>
      )}
      {isAllMatchingSelected && (
        <div className="bg-secondary/50 p-2 text-center text-sm border-b border-border">
          <span>All {totalEstimate.toLocaleString()} conversations in this folder are selected. </span>
          <Button variant="link" className="h-auto p-0" onClick={onClearSelection}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4">
        <Checkbox
          checked={allOnPageSelected || isAllMatchingSelected}
          onCheckedChange={onSelectAll}
        />
        <span className="text-sm text-muted-foreground">
          {isAllMatchingSelected 
            ? `All ${totalEstimate} selected` 
            : selectedEmails.size > 0 
              ? `${selectedEmails.size} selected` 
              : 'All'}
        </span>
      </div>

      {/* Email Rows */}
      <div className="divide-y divide-border">
        {emails.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No emails found</p>
          </div>
        ) : (
          emails.map((email: Email) => (
            <div
              key={email.id}
              className={`px-6 py-4 hover:bg-muted transition-colors flex items-start gap-4 cursor-pointer group ${email.is_unread ? 'bg-muted/30' : ''}`}
              onClick={() => onOpenEmail(email.id)}
            >
              <Checkbox
                checked={selectedEmails.has(email.id) || isAllMatchingSelected}
                onCheckedChange={() => onSelectEmail(email.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium text-foreground truncate ${email.is_unread ? 'font-bold' : ''}`}>
                    {email.sender}
                  </span>
                  <span className={`text-xs text-muted-foreground whitespace-nowrap ml-2 ${email.is_unread ? 'font-bold text-foreground' : ''}`}>
                    {email.date}
                  </span>
                </div>
                <p className={`text-sm text-foreground mb-1 truncate ${email.is_unread ? 'font-bold' : ''}`}>
                  {email.subject}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {email.snippet}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}