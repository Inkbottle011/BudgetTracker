import { useState, useCallback } from 'react'
import { ToastType, ToastAction } from './Toast'

export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean; action?: ToastAction }>({
        message: '',
        type: 'success',
        visible: false,
    })

    const showToast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction) => {
        setToast({ message, type, visible: true, action })
    }, [])

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, visible: false }))
    }, [])

    return { toast, showToast, hideToast }
}