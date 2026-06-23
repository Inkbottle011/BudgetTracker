import React, { createContext, useContext } from 'react'
import { ToastType } from '../components/Toast'

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToastContext() {
    return useContext(ToastContext)
}