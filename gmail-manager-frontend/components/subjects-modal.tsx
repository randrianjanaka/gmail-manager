'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Selection {
  type: 'folder' | 'label';
  name: string;
  subfolder?: string;
}

interface SubjectsModalProps {
  selection: Selection
  onClose: () => void
}

const API_BASE = '/api'

export default function SubjectsModal({ selection, onClose }: SubjectsModalProps) {
  const [subjects, setSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

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
    fetchSubjects()
  }, [selection])

  const fetchSubjects = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selection.type === 'label') {
        params.append('label', selection.name)
      } else {
        params.append('folder', selection.name)
        if (selection.subfolder) {
          params.append('inbox_filter', selection.subfolder)
        }
      }

      const response = await fetch(
        `${API_BASE}/subjects/unique?${params.toString()}`
      )
      if (response.ok) {
        const data = await response.json()
        setSubjects(Array.isArray(data) ? data : data.subjects || [])
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            Unique Subjects in {selection.name} {selection.subfolder ? `(${selection.subfolder})` : ''}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : subjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No subjects found
            </p>
          ) : (
            <ul className="space-y-3">
              {subjects.map((subject, idx) => (
                <li
                  key={idx}
                  className="p-3 bg-muted rounded-lg text-foreground text-sm break-words"
                >
                  {subject}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6 flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}