'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Task {
    id: string;
    name: string;
    abortController: AbortController;
}

interface TaskContextType {
    tasks: Task[];
    addTask: (name: string, abortController: AbortController) => string;
    removeTask: (id: string) => void;
    cancelTask: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([]);

    const addTask = useCallback((name: string, abortController: AbortController) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newTask: Task = { id, name, abortController };
        
        setTasks(prev => [...prev, newTask]);
        return id;
    }, []);

    const removeTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(task => task.id !== id));
    }, []);

    const cancelTask = useCallback((id: string) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === id);
            if (task) {
                task.abortController.abort();
            }
            return prev.filter(t => t.id !== id);
        });
    }, []);

    return (
        <TaskContext.Provider value={{ tasks, addTask, removeTask, cancelTask }}>
            {children}
        </TaskContext.Provider>
    );
}

export function useTasks() {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
}
