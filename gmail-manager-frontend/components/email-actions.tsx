'use client'

import { Archive, Tag, Trash2, MailOpen, Mail, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmailActionsProps {
  selectedCount: number
  onArchive: () => void
  onAssignLabels: () => void
  onMoveToTrash: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onViewSubjects: () => void
}

export default function EmailActions({
  selectedCount,
  onArchive,
  onAssignLabels,
  onMoveToTrash,
  onMarkRead,
  onMarkUnread,
  onViewSubjects
}: EmailActionsProps) {
  return (
    <div className="mb-6 p-4 bg-muted rounded-lg border border-border flex items-center justify-between flex-wrap gap-4">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} email{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onViewSubjects}
          className="flex items-center gap-2"
          title="View unique subjects"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkRead}
          className="flex items-center gap-2"
          title="Mark as read"
        >
          <MailOpen className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkUnread}
          className="flex items-center gap-2"
          title="Mark as unread"
        >
          <Mail className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={onArchive}
          className="flex items-center gap-2"
        >
          <Archive className="w-4 h-4" />
          Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onAssignLabels}
          className="flex items-center gap-2"
        >
          <Tag className="w-4 h-4" />
          Assign Label
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onMoveToTrash}
          className="flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Move to Trash
        </Button>
      </div>
    </div>
  )
}