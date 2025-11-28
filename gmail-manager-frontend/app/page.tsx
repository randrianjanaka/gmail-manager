'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, Loader2, Eye, Menu, X, PanelLeft } from 'lucide-react'
import Dashboard from '@/components/dashboard'
import FolderNav from '@/components/folder-nav'
import EmailList from '@/components/email-list'
import EmailActions from '@/components/email-actions'
import LabelModal from '@/components/label-modal'
import FiltersPanel, { FilterValues } from '@/components/filters-panel'
import PaginationControls from '@/components/pagination-controls'
import EmailContentModal from '@/components/email-content-modal'
import SubjectsModal from '@/components/subjects-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeToggle } from '@/components/theme-toggle'
import { Progress } from '@/components/ui/progress'
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
const BATCH_CHUNK_SIZE = 20; // Number of emails to process per frontend request

interface EmailResponse {
  emails: any[]
  next_page_token?: string
  total_estimate?: number
}

interface EmailIdListResponse {
    ids: string[]
}

interface Label {
  id: string;
  name: string;
  type: 'system' | 'user';
}

interface ProgressState {
    current: number;
    total: number;
    message: string;
}

import { TaskProvider, useTasks } from '@/contexts/task-context'
import TaskList from '@/components/task-list'

export default function Home() {
  return (
    <TaskProvider>
      <HomeContent />
      <TaskList />
    </TaskProvider>
  )
}

function HomeContent() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'emails'>('dashboard')
  const [selection, setSelection] = useState<{ type: 'folder' | 'label', name: string, subfolder?: string }>({ type: 'folder', name: 'INBOX', subfolder: 'Primary' });
  const [emails, setEmails] = useState<any[]>([])
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLabels, setLoadingLabels] = useState(true)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [showSubjectsModal, setShowSubjectsModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [idsToArchive, setIdsToArchive] = useState<string[] | null>(null);
  const [selectedEmailSubjects, setSelectedEmailSubjects] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  
  // Pagination state
  const [pageTokens, setPageTokens] = useState<string[]>(['start']); 
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalEstimate, setTotalEstimate] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  const [currentFilters, setCurrentFilters] = useState<FilterValues>({})
  const { toast } = useToast()

  // Helper to build filters for API calls (reused in fetchEmails and Batch actions)
  const getApiFilters = useCallback(() => {
    const apiFilters: any = { ...currentFilters };
    if (selection.type === 'label') {
      apiFilters.label = selection.name;
    } else {
      apiFilters.folder = selection.name;
      if (selection.subfolder) {
        apiFilters.inbox_filter = selection.subfolder;
      }
    }
    return apiFilters;
  }, [selection, currentFilters]);

  const buildQueryParams = useCallback((overrideToken?: string): string => {
    const params = new URLSearchParams()
    const apiFilters = getApiFilters();
    Object.entries(apiFilters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    
    params.append('max_results', String(itemsPerPage));

    const token = overrideToken !== undefined ? overrideToken : pageTokens[currentPageIndex];
    if (token && token !== 'start') {
      params.append('page_token', token)
    }

    return params.toString()
  }, [getApiFilters, currentPageIndex, pageTokens, itemsPerPage]);


  const fetchEmails = useCallback(async (tokenOverride?: string) => {
    if (currentView !== 'emails') return;
    setLoading(true)
    // Don't clear selection if we are just navigating pages and "Select All Matching" is active
    // But standard behavior is usually to clear on page change unless "All Matching" is set.
    // We'll keep simple: clear manual selection on page load.
    if (!isAllMatchingSelected) {
        setSelectedEmails(new Set());
    }
    
    try {
      const queryString = buildQueryParams(tokenOverride);
      const response = await fetch(`${API_BASE}/emails?${queryString}`)
      if (response.ok) {
        const data: EmailResponse = await response.json()
        setEmails(data.emails || [])
        setTotalEstimate(data.total_estimate || 0)
        setNextPageToken(data.next_page_token || null)
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
      setEmails([]);
      setTotalEstimate(0);
      setNextPageToken(null);
    } finally {
      setLoading(false)
    }
  }, [currentView, buildQueryParams, isAllMatchingSelected]);

  // Trigger fetch on dependency changes
  useEffect(() => {
    fetchEmails();
  }, [currentPageIndex, itemsPerPage, selection, currentFilters]); // Removed fetchEmails from dependency to avoid loops, rely on explicit deps

  useEffect(() => {
    const fetchAllLabels = async () => {
        setLoadingLabels(true);
        try {
            const response = await fetch(`${API_BASE}/labels`);
            if (response.ok) {
                const data = await response.json();
                setAllLabels(data.labels || []);
            }
        } catch (error) {
            console.error('Failed to fetch labels:', error);
        } finally {
            setLoadingLabels(false);
        }
    };
    fetchAllLabels();
  }, []);


  // Removed auto-fetch dashboard effect


  const resetAndFetch = () => {
    setCurrentPageIndex(0);
    setPageTokens(['start']);
    setNextPageToken(null);
    setCurrentFilters({});
    setIsAllMatchingSelected(false);
    setSelectedEmails(new Set());
  };

  const handleSelectFolder = (folder: string, subfolder?: string) => {
    setSelection({ type: 'folder', name: folder, subfolder: subfolder });
    resetAndFetch();
  }

  const handleSelectLabel = (label: string) => {
    setSelection({ type: 'label', name: label });
    resetAndFetch();
  }

  const handleSelectEmail = (emailId: string) => {
    if (isAllMatchingSelected) {
        // If we uncheck one while in "All Matching" mode, we technically exit that mode
        // But typically complex UIs handle exclude lists. For simplicity, we revert to manual selection
        setIsAllMatchingSelected(false);
        const newSelected = new Set(emails.map(e => e.id)); // Select all on current page
        newSelected.delete(emailId);
        setSelectedEmails(newSelected);
        return;
    }
    const newSelected = new Set(selectedEmails)
    newSelected.has(emailId) ? newSelected.delete(emailId) : newSelected.add(emailId);
    setSelectedEmails(newSelected)
  }

  const handleSelectAll = () => {
    if (isAllMatchingSelected) {
        // Clear everything
        setIsAllMatchingSelected(false);
        setSelectedEmails(new Set());
    } else {
        // If all on current page are selected, clear. Else select all on current page.
        if (selectedEmails.size === emails.length && emails.length > 0) {
            setSelectedEmails(new Set());
        } else {
            setSelectedEmails(new Set(emails.map((e) => e.id)));
        }
    }
  }

  const handleSelectAllMatching = () => {
      setIsAllMatchingSelected(true);
      setSelectedEmails(new Set(emails.map(e => e.id))); // Visually select current page too
  }

  const handleClearSelection = () => {
      setIsAllMatchingSelected(false);
      setSelectedEmails(new Set());
  }
  
  // Generic helper to chunk operations on the frontend
  const processBatchOperation = async (
      action: string, 
      baseBody: any, 
      description: string, 
      targetIds: string[] | null
    ) => {
    setLoading(true);
    
    try {
        let idsToProcess: string[] = [];

        if (isAllMatchingSelected) {
            setProgress({ current: 0, total: 0, message: `Retrieving list of emails...` });
            
            // Fetch all IDs from backend first
            const params = new URLSearchParams();
            const apiFilters = getApiFilters();
            Object.entries(apiFilters).forEach(([key, value]) => {
                if (value) params.append(key, String(value));
            });
            
            const res = await fetch(`${API_BASE}/emails/ids?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch email IDs");
            const data: EmailIdListResponse = await res.json();
            idsToProcess = data.ids;
        } else if (targetIds) {
            idsToProcess = targetIds;
        }

        if (idsToProcess.length > 0) {
            const total = idsToProcess.length;
            let processed = 0;
            setProgress({ current: 0, total, message: `${description} (0/${total})` });

            for (let i = 0; i < total; i += BATCH_CHUNK_SIZE) {
                const chunk = idsToProcess.slice(i, i + BATCH_CHUNK_SIZE);
                const body = { ...baseBody, ids: chunk, select_all_matching: false };
                
                await fetch(`${API_BASE}/actions/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                
                processed += chunk.length;
                setProgress({ current: processed, total, message: `${description} (${processed}/${total})` });
            }
        }

        toast({ title: "Success", description: "Action completed successfully." });
        
        // Cleanup
        if (!selectedEmailId) handleClearSelection(); // Don't clear if single view
        await fetchEmails();
        
    } catch (error) {
        console.error(`Failed to perform ${action}:`, error);
        toast({ variant: "destructive", title: "Error", description: `Failed to ${description.toLowerCase()}.` });
    } finally {
        setLoading(false);
        setProgress(null);
    }
  };

  const performActionOnSelected = async (action: 'archive' | 'trash' | 'mark_read' | 'mark_unread') => {
    const ids = selectedEmailId ? [selectedEmailId] : Array.from(selectedEmails);
    const actionMap: Record<string, string> = {
        'archive': 'Archiving emails',
        'trash': 'Moving emails to trash',
        'mark_read': 'Marking emails as read',
        'mark_unread': 'Marking emails as unread'
    };
    
    await processBatchOperation(action, { action }, actionMap[action], ids);
  }

  const handleAssignLabels = async (labels: string[]) => {
    const ids = selectedEmailId ? [selectedEmailId] : Array.from(selectedEmails);
    
    // Close modal immediately to show progress
    setShowLabelModal(false);
    setLoading(true);
    
    try {
        let idsToProcess: string[] = [];

        if (isAllMatchingSelected) {
            setProgress({ current: 0, total: 0, message: `Retrieving list of emails...` });
            const params = new URLSearchParams();
            const apiFilters = getApiFilters();
            Object.entries(apiFilters).forEach(([key, value]) => {
                if (value) params.append(key, String(value));
            });
            const res = await fetch(`${API_BASE}/emails/ids?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch email IDs");
            const data: EmailIdListResponse = await res.json();
            idsToProcess = data.ids;
        } else {
            idsToProcess = ids;
        }
        
        if (idsToProcess.length > 0) {
            const total = idsToProcess.length;
            let processed = 0;
            setProgress({ current: 0, total, message: `Assigning labels (0/${total})` });

            for (let i = 0; i < total; i += BATCH_CHUNK_SIZE) {
                const chunk = idsToProcess.slice(i, i + BATCH_CHUNK_SIZE);
                const body = { 
                    action: 'assign_labels', 
                    add_label_names: labels,
                    ids: chunk, 
                    select_all_matching: false 
                };
                
                await fetch(`${API_BASE}/actions/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                processed += chunk.length;
                setProgress({ current: processed, total, message: `Assigning labels (${processed}/${total})` });
            }
        }

      toast({ title: "Success", description: "Labels assigned." })
      
      // Save the IDs we just processed so archive logic knows what to act on
      setIdsToArchive(idsToProcess);
      setShowArchiveConfirm(true);
      
      // We refresh in background but keep loading state false here (managed by alert dialog now)
      // fetchEmails(); // REMOVED: Don't fetch yet, wait for archive decision
    } catch (error) {
      console.error('Failed to assign labels:', error)
      toast({ variant: "destructive", title: "Error", description: "Failed to assign labels." })
      // If failed, reopen modal so user can retry? Or just stay on screen.
    } finally {
        setLoading(false);
        setProgress(null);
    }
  }

  const handleConfirmArchive = async () => {
      // Re-use the chunk processor logic
      // Note: idsToArchive contains specific IDs OR is empty array (if all matching was true)
      // But processBatchOperation logic for 'all matching' relies on the current `isAllMatchingSelected` state
      // which is still valid here.
      
      // If we are in single view (selectedEmailId exists), isAllMatchingSelected is likely false.
      // idsToArchive handles the list correctly.
      
      // Close dialog first
      setShowArchiveConfirm(false);
      
      // If idsToArchive is empty and NOT all matching, it means empty selection which shouldn't happen.
      // If idsToArchive is empty AND all matching is true, we pass null/empty IDs and rely on state.
      
      const ids = (idsToArchive && idsToArchive.length > 0) ? idsToArchive : null;
      // Note: We don't need to check isAllMatchingSelected here because 
      // handleAssignLabels already resolved the full list of IDs into idsToArchive.
      
      await processBatchOperation('archive', { action: 'archive' }, 'Archiving emails', ids);
      
    // Refresh list AFTER archive action
    await fetchEmails();

      setSelectedEmailId(null); // Ensure single view closes if applicable
  }
  
  const handleCancelArchive = () => {
      setShowArchiveConfirm(false);
      if (!selectedEmailId) {
          handleClearSelection();
        fetchEmails(); // Refresh list if they chose NOT to archive
      }
  }

  const handleApplyFilters = (filters: FilterValues) => {
    setCurrentPageIndex(0);
    setPageTokens(['start']);
    setNextPageToken(null);
    setCurrentFilters(filters)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPageIndex(0);
    setPageTokens(['start']);
    setNextPageToken(null);
  };

  const handleOpenEmail = (emailId: string) => {
    setSelectedEmailId(emailId)
    setShowEmailModal(true)
  }

  const handleViewSelectedSubjects = () => {
    const subjects = new Set<string>();

    if (isAllMatchingSelected) {
      // In "All Matching" mode, we can't easily get all subjects without fetching.
      // For now, we'll just show subjects from the current page that are selected (which is all of them)
      // OR we could disable this button for "All Matching".
      // Let's stick to current page for simplicity as per requirement "avoid fetching again".
      emails.forEach(email => {
        if (email.subject) subjects.add(email.subject);
      });
    } else {
      // Iterate through selected IDs and find them in the current emails list
      // Note: This only works for emails currently loaded in memory (current page).
      // If selection spans multiple pages (not possible with current UI except "All Matching"), 
      // we would miss them. But current UI clears selection on page change unless "All Matching".
      selectedEmails.forEach(id => {
        const email = emails.find(e => e.id === id);
        if (email && email.subject) {
          subjects.add(email.subject);
        }
      });
    }

    setSelectedEmailSubjects(Array.from(subjects));
    setShowSubjectsModal(true);
  }

  const handleNextPage = () => {
    if (nextPageToken) {
      setPageTokens(prev => [...prev, nextPageToken]);
      setCurrentPageIndex(prev => prev + 1);
    }
  }

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  }

  // Client-side "seeking" for page jump
  // Note: This is recursive/looping and might be slow for large jumps
  const handleJumpToPage = async (targetPageIndex: number) => {
      if (targetPageIndex === currentPageIndex) return;
      
      // If we have the token in history, jump directly
      if (targetPageIndex < pageTokens.length) {
          setCurrentPageIndex(targetPageIndex);
          return;
      }
      
      // If target is ahead, we need to fetch intermediate pages
      // We start from the last known page
      let currentIndex = pageTokens.length - 1;
      let currentToken = pageTokens[currentIndex];
      
      setLoading(true);
      try {
        while (currentIndex < targetPageIndex) {
            // Construct query for the current token
            const params = new URLSearchParams();
             const apiFilters = getApiFilters();
            Object.entries(apiFilters).forEach(([key, value]) => {
                if (value) params.append(key, String(value));
            });
            params.append('max_results', String(itemsPerPage));
            if (currentToken && currentToken !== 'start') params.append('page_token', currentToken);
            
            // Fetch only metadata to get next token fast
            const res = await fetch(`${API_BASE}/emails?${params.toString()}`);
            const data = await res.json();
            
            if (!data.next_page_token) {
                // Reached end of list before target page
                break;
            }
            
            currentToken = data.next_page_token;
            setPageTokens(prev => {
                // Avoid duplicates if race conditions occur
                if (prev.length <= currentIndex + 1) return [...prev, currentToken];
                return prev;
            });
            currentIndex++;
        }
        
        // Finally set the page index to what we reached
        setCurrentPageIndex(currentIndex);
      } catch (e) {
          console.error("Error seeking page:", e);
          toast({ variant: "destructive", title: "Error", description: "Failed to jump to page." })
      } finally {
          setLoading(false);
      }
  };
  
  const currentStart = currentPageIndex * itemsPerPage + 1;
  const currentEnd = currentStart + emails.length - 1;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background relative flex-col md:flex-row">
      <Toaster />
      {/* Mobile Header */}
      <div className="md:hidden p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Gmail</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card flex-col h-full transition-transform duration-300 ease-in-out md:static
        ${isMobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
        ${isSidebarOpen ? 'md:flex md:translate-x-0' : 'md:hidden'}
      `}>
        <div className="p-6 border-b border-border shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Gmail</h1>
          </div>
          <div className="flex items-center gap-1">
            <div className="md:block hidden">
              <ThemeToggle />
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav className="p-4 space-y-2">
            <button onClick={() => setCurrentView('dashboard')} className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}>Dashboard</button>
            <button onClick={() => setCurrentView('emails')} className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${currentView === 'emails' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}>Emails</button>
          </nav>

          {currentView === 'emails' && (
            <FolderNav
              selection={selection}
              onSelectFolder={handleSelectFolder}
              onSelectLabel={handleSelectLabel}
              labels={allLabels}
              loading={loadingLabels}
            />
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="p-2 border-b border-border flex items-center gap-2 bg-card shrink-0 hidden md:flex">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Sidebar">
            <PanelLeft className="w-5 h-5" />
          </Button>
        </div>
        {currentView === 'dashboard' ? (
          <Dashboard allLabels={allLabels} />
        ) : (
          <div className="p-6 flex-1 overflow-hidden flex flex-col">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">
                {selection.type === 'label' ? `Label: ${selection.name}` : selection.subfolder ? `${selection.subfolder}` : selection.name}
              </h2>
              <Button size="sm" variant="outline" onClick={() => setShowSubjectsModal(true)}>
                <Eye className="w-4 h-4 mr-2" />
                Unique Subjects
              </Button>
            </div>

            <FiltersPanel onApplyFilters={handleApplyFilters} />

            {(selectedEmails.size > 0 || isAllMatchingSelected) && (
              <EmailActions
                selectedCount={isAllMatchingSelected ? totalEstimate : selectedEmails.size}
                onArchive={() => performActionOnSelected('archive')}
                onAssignLabels={() => setShowLabelModal(true)}
                onMoveToTrash={() => performActionOnSelected('trash')}
                onMarkRead={() => performActionOnSelected('mark_read')}
                onMarkUnread={() => performActionOnSelected('mark_unread')}
                  onViewSubjects={handleViewSelectedSubjects}
              />
            )}

            {loading && !progress ? (
              <div className="flex items-center justify-center py-12 flex-1"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="flex-1 overflow-auto">
                  <EmailList
                    emails={emails}
                    selectedEmails={selectedEmails}
                    onSelectEmail={handleSelectEmail}
                    onSelectAll={handleSelectAll}
                    onOpenEmail={handleOpenEmail}
                    totalEstimate={totalEstimate}
                    onSelectAllMatching={handleSelectAllMatching}
                    isAllMatchingSelected={isAllMatchingSelected}
                    onClearSelection={handleClearSelection}
                  />
                </div>
                {totalEstimate > 0 && (
                  <PaginationControls
                    totalEstimate={totalEstimate}
                    currentStart={currentStart}
                    currentEnd={currentEnd}
                    hasNextPage={!!nextPageToken}
                    hasPrevPage={currentPageIndex > 0}
                    onNext={handleNextPage}
                    onPrev={handlePrevPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    currentPageIndex={currentPageIndex}
                    onJumpToPage={handleJumpToPage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showLabelModal && (
        <LabelModal
          onClose={() => setShowLabelModal(false)}
          onAssign={handleAssignLabels}
          allLabels={allLabels.filter(l => l.type === 'user')}
          loading={loading}
        />
      )}

      {showSubjectsModal && (
        <SubjectsModal
          selection={selection}
          onClose={() => {
            setShowSubjectsModal(false)
            setSelectedEmailSubjects([])
          }}
          preloadedSubjects={selectedEmailSubjects.length > 0 ? selectedEmailSubjects : undefined}
          title={selectedEmailSubjects.length > 0 ? "Unique Subjects in Selection" : undefined}
        />
      )}

      {showEmailModal && selectedEmailId && (
        <EmailContentModal
          emailId={selectedEmailId}
          onClose={() => {
            setShowEmailModal(false)
            setSelectedEmailId(null)
          }}
          onAssignLabel={() => setShowLabelModal(true)}
          onRefresh={fetchEmails}
        />
      )}

        <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Archive Conversations?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have successfully assigned labels. Do you want to archive the selected conversation(s) as well?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancelArchive} disabled={loading}>No, keep in Inbox</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmArchive} disabled={loading}>
                        Yes, Archive
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Progress Overlay */}
        {progress && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[80] flex items-center justify-center">
                <div className="bg-card border border-border rounded-lg p-6 shadow-lg max-w-sm w-full space-y-4">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <h3 className="font-semibold text-foreground">Processing</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{progress.message}</p>
                    {progress.total > 0 ? (
                        <Progress value={(progress.current / progress.total) * 100} />
                    ) : (
                        <div className="h-2 w-full bg-secondary overflow-hidden rounded-full">
                             <div className="h-full bg-primary animate-progress origin-left-right"></div>
                        </div>
                    )}
                </div>
            </div>
        )}

      {/* Mobile Overlay */}
      {
        isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )
      }
    </div>
  )
}