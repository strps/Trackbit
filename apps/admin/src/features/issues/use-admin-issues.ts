import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = `${import.meta.env.VITE_API_URL}/admin/issues`

export interface AdminIssue {
    id: number
    type: 'bug' | 'feedback'
    title: string | null
    path: string | null
    description: string
    stackTrace: string | null
    status: 'open' | 'resolved' | 'closed'
    createdAt: string | null
    updatedAt: string | null
    userId: string | null
    userName: string | null
    userEmail: string | null
}

async function fetchIssues(): Promise<AdminIssue[]> {
    const res = await fetch(API_URL, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch issues')
    return res.json()
}

async function updateStatusFn({ id, status }: { id: number; status: AdminIssue['status'] }): Promise<AdminIssue> {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Failed to update issue')
    return res.json()
}

export function useAdminIssues() {
    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'issues'] })

    const issuesQuery = useQuery({
        queryKey: ['admin', 'issues'],
        queryFn: fetchIssues,
    })

    const updateMutation = useMutation({
        mutationFn: updateStatusFn,
        onSuccess: invalidate,
    })

    return {
        issues: issuesQuery.data ?? [],
        isLoading: issuesQuery.isLoading,
        updateStatus: updateMutation.mutate,
        isUpdating: updateMutation.isPending,
    }
}
