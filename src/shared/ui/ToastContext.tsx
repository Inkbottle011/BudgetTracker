import React, { createContext, useContext } from 'react'
import { ToastType, ToastAction } from './Toast'

interface ToastContextType {
    /** `action` adds a button, such as Undo after deleting something */
    showToast: (message: string, type?: ToastType, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToastContext() {
    return useContext(ToastContext)
}