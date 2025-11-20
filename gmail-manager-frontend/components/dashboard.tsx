'use client'

import { Mail, InboxIcon, Send, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardProps {
  data: {
    total_emails?: number
    unread_emails?: number
    sent_emails?: number
  } | null
}

export default function Dashboard({ data }: DashboardProps) {
  const metrics = [
    {
      title: 'Total Emails',
      value: data?.total_emails || 0,
      icon: Mail,
      color: 'text-blue-500',
    },
    {
      title: 'Unread Emails',
      value: data?.unread_emails || 0,
      icon: InboxIcon,
      color: 'text-green-500',
    },
    {
      title: 'Sent Emails',
      value: data?.sent_emails || 0,
      icon: Send,
      color: 'text-purple-500',
    },
  ]

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your email account
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                  {metric.value}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-card">
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
  )
}
