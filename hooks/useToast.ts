import { useState, useCallback } from 'react'
import { ToastType } from '../components/Toast'

export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
        message: '',
        type: 'success',
        visible: false,
    })

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type, visible: true })
    }, [])

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, visible: false }))
    }, [])

    return { toast, showToast, hideToast }
}