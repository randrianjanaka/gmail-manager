'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Trash2, Tag, Archive, Mail, MailOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DOMPurify from 'dompurify'

interface Email {
  id: string
  sender: string
  to: string
  subject: string
  date: string
  body: string
  is_unread: boolean
}

interface EmailContentModalProps {
  emailId: string
  onClose: () => void
  onAssignLabel: () => void
  onRefresh: () => void
}

const API_BASE = 'http://127.0.0.1:8000'

export default function EmailContentModal({
  emailId,
  onClose,
  onAssignLabel,
  onRefresh,
}: EmailContentModalProps) {
  const [email, setEmail] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)
  const [trashing, setTrashing] = useState(false)
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchEmailContent = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/emails/${emailId}`)
        if (response.ok) setEmail(await response.json())
      } catch (error) {
        console.error('Failed to fetch email:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEmailContent()
  }, [emailId])

  const handleMoveToTrash = async () => {
    setTrashing(true)
    try {
      const response = await fetch(`${API_BASE}/emails/${emailId}/trash`, { method: 'POST' })
      if (response.ok) {
        onRefresh()
        onClose()
      }
    } catch (error) {
      console.error('Failed to move to trash:', error)
    } finally {
      setTrashing(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`${API_BASE}/emails/${emailId}/archive`, { method: 'POST' });
      if (response.ok) {
        onRefresh();
        onClose();
      }
    } catch (error) {
      console.error('Failed to archive email:', error);
    } finally {
      setArchiving(false);
    }
  };

  const handleToggleReadStatus = async () => {
      if (!email) return;
      const action = email.is_unread ? 'mark_read' : 'mark_unread';
      // Optimistic update
      setEmail(prev => prev ? ({ ...prev, is_unread: !prev.is_unread }) : null);
      
      try {
           await fetch(`${API_BASE}/actions/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, ids: [emailId] })
        });
        onRefresh(); // Refresh list in background
      } catch (error) {
          console.error("Failed to toggle read status", error);
          // Revert
           setEmail(prev => prev ? ({ ...prev, is_unread: !prev.is_unread }) : null);
      }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in-0">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={handleToggleReadStatus} title={email?.is_unread ? "Mark as read" : "Mark as unread"}>
                {email?.is_unread ? <MailOpen className="w-4 h-4"/> : <Mail className="w-4 h-4"/>}
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button size="sm" variant="outline" onClick={onAssignLabel}><Tag className="w-4 h-4 mr-2" />Assign Label</Button>
            <Button size="sm" variant="outline" onClick={handleArchive} disabled={archiving}><Archive className="w-4 h-4 mr-2" />{archiving ? 'Archiving...' : 'Archive'}</Button>
            <Button size="sm" variant="destructive" onClick={handleMoveToTrash} disabled={trashing}><Trash2 className="w-4 h-4 mr-2" />{trashing ? 'Moving...' : 'Move to Trash'}</Button>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 flex-1"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : email ? (
          <>
            <div className="p-6 border-b border-border space-y-2">
              <div className="flex justify-between items-start gap-4">
                <h2 className="text-xl font-bold text-foreground break-words">{email.subject}</h2>
                <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">{email.date}</span>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">From: <span className="font-medium text-foreground">{email.sender}</span></p>
                <p className="text-muted-foreground">To: <span className="font-medium text-foreground">{email.to}</span></p>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-background">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body) }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 flex-1"><p className="text-muted-foreground">Failed to load email content.</p></div>
        )}
      </div>
    </div>
  )
}