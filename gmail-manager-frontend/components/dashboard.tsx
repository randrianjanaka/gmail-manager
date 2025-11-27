import { useState, useEffect } from 'react'
import { Mail, InboxIcon, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTasks } from '@/contexts/task-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from "@/components/ui/select"
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
import { Button } from "@/components/ui/button"

interface DashboardProps {
  allLabels?: any[]
}

interface SubjectCount {
  subject: string
  count: number
}

const API_BASE = '/api'

export default function Dashboard({ allLabels = [] }: DashboardProps) {
  const [stats, setStats] = useState({ total_emails: 0, unread_emails: 0 })
  const [loadingStats, setLoadingStats] = useState(true)
  const [subjectCounts, setSubjectCounts] = useState<SubjectCount[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [showLoadPrompt, setShowLoadPrompt] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // We don't use selectedFolder/Subfolder for filtering anymore in this simplified view
  // but keeping them if we want to re-add filtering later.
  // const [selectedFolder, setSelectedFolder] = useState('INBOX')
  // const [selectedSubfolder, setSelectedSubfolder] = useState('Primary')

  const { addTask, removeTask } = useTasks();

  useEffect(() => {
    // Prompt user on mount instead of auto-loading
    if (!hasLoaded) {
      setShowLoadPrompt(true)
    }
  }, [])

  const handleConfirmLoad = () => {
    setShowLoadPrompt(false)
    loadDashboardData()
  }

  const handleCancelLoad = () => {
    setShowLoadPrompt(false)
    // We just don't load. The user sees empty states and can click "Refresh" or similar if we add one.
    setLoadingStats(false)
  }

  const loadDashboardData = () => {
    setHasLoaded(true)
    setLoadingStats(true)
    setLoadingSubjects(true)

    // 1. Fetch Stats (Fast)
    fetch(`${API_BASE}/dashboard/summary`)
      .then(res => res.json())
      .then(data => {
        setStats({
          total_emails: data.total_emails || 0,
          unread_emails: data.unread_emails || 0
        })
      })
      .catch(err => console.error("Failed to fetch stats:", err))
      .finally(() => setLoadingStats(false))

    // 2. Fetch Subjects (Slower)
    const controller = new AbortController()

    fetch(`${API_BASE}/dashboard/subjects`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setSubjectCounts(data.subjects || [])
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Failed to fetch subjects:", err)
        }
      })
      .finally(() => setLoadingSubjects(false))

    return controller
  }

  const metrics = [
    {
      title: 'Total Emails (Primary)',
      value: stats.total_emails || 0,
      icon: Mail,
      color: 'text-blue-500',
    },
    {
      title: 'Unread Emails (Primary)',
      value: stats.unread_emails || 0,
      icon: InboxIcon,
      color: 'text-green-500',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <Button onClick={loadDashboardData} variant="outline" size="sm" disabled={loadingStats}>
            {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Refresh Data
          </Button>
        </div>
        <p className="text-muted-foreground">
          Overview of your email account
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title} className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  {metric.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    metric.value
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject Analysis */}
        <div className="bg-card border border-border rounded-lg p-6 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Top Subjects (Last 500 Emails)</h3>
            <div className="flex gap-2">
              <Select defaultValue="INBOX-Primary" onValueChange={(val) => console.log("Filter:", val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select View" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Inbox Categories</SelectLabel>
                    <SelectItem value="INBOX-Primary">Inbox (Primary)</SelectItem>
                    <SelectItem value="INBOX-Promotions">Inbox (Promotions)</SelectItem>
                    <SelectItem value="INBOX-Social">Inbox (Social)</SelectItem>
                    <SelectItem value="INBOX-Notifications">Inbox (Notifications)</SelectItem>
                    <SelectItem value="INBOX-Forums">Inbox (Forums)</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>System</SelectLabel>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="TRASH">Trash</SelectItem>
                    <SelectItem value="SPAM">Spam</SelectItem>
                  </SelectGroup>
                  {allLabels && allLabels.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Labels</SelectLabel>
                        {allLabels.filter(l => l.type === 'user').map((label) => (
                          <SelectItem key={label.id} value={label.name}>
                            {label.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingSubjects ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing subjects...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Subject</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectCounts.slice(0, 10).map((subject, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-md" title={subject.subject}>
                        {subject.subject}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {subject.count}
                      </td>
                    </tr>
                  ))}
                  {subjectCounts.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                        No subjects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Alerts Placeholder */}
        <Card className="bg-card col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="w-5 h-5" />
              Custom Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Custom alerts feature will be available soon. Stay tuned!
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showLoadPrompt} onOpenChange={setShowLoadPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Dashboard Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to load the latest statistics and subject analysis from your Gmail account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLoad}>No, later</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLoad}>Yes, load data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
