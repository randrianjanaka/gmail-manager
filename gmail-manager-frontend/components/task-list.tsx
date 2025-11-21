'use client'

import { useTasks } from '@/contexts/task-context'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TaskList() {
    const { tasks, cancelTask } = useTasks();

    if (tasks.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
            {tasks.map(task => (
                <div key={task.id} className="bg-card border border-border shadow-lg rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-right-full pointer-events-auto">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        <span className="text-sm font-medium truncate" title={task.name}>{task.name}</span>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => cancelTask(task.id)}
                        title="Cancel Task"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    )
}
