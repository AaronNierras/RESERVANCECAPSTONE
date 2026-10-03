import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LeaveConfirmModal from '../components/activity-factory/LeaveConfirmModal'

const ActivityFactoryGuardContext = createContext(null)

export function ActivityFactoryGuardProvider({ children }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const pendingRef = useRef(null)
  const handlersRef = useRef({})

  const runPending = useCallback((action) => {
    if (!action) return
    if (action.type === 'navigate') navigate(action.to)
    else if (action.type === 'callback') action.fn()
  }, [navigate])

  const registerGuard = useCallback((config) => {
    setBlocking(Boolean(config?.blocking))
    handlersRef.current = config?.handlers || {}
  }, [])

  const unregisterGuard = useCallback(() => {
    setBlocking(false)
    handlersRef.current = {}
    pendingRef.current = null
    setOpen(false)
  }, [])

  const promptLeave = useCallback((action) => {
    if (!blocking) {
      runPending(action)
      return
    }
    pendingRef.current = action
    setOpen(true)
  }, [blocking, runPending])

  const closePrompt = useCallback(() => {
    setOpen(false)
    pendingRef.current = null
  }, [])

  const onContinue = () => closePrompt()

  const onSaveDraft = async () => {
    const action = pendingRef.current
    setOpen(false)
    pendingRef.current = null
    try {
      await handlersRef.current.onSaveDraft?.()
    } catch {
      return
    }
    runPending(action)
  }

  const onExit = () => {
    const action = pendingRef.current
    setOpen(false)
    pendingRef.current = null
    handlersRef.current.onExit?.()
    runPending(action)
  }

  return (
    <ActivityFactoryGuardContext.Provider value={{ registerGuard, unregisterGuard, promptLeave, blocking }}>
      {children}
      <LeaveConfirmModal
        open={open}
        onContinue={onContinue}
        onSaveDraft={onSaveDraft}
        onExit={onExit}
      />
    </ActivityFactoryGuardContext.Provider>
  )
}

export function useActivityFactoryGuard() {
  const ctx = useContext(ActivityFactoryGuardContext)
  if (!ctx) {
    throw new Error('useActivityFactoryGuard must be used within ActivityFactoryGuardProvider')
  }
  return ctx
}

export function useGuardedNavigation() {
  const { promptLeave, blocking } = useActivityFactoryGuard()

  const guardedNavigate = useCallback((to) => {
    promptLeave({ type: 'navigate', to })
  }, [promptLeave])

  const guardedAction = useCallback((fn) => {
    promptLeave({ type: 'callback', fn })
  }, [promptLeave])

  return { guardedNavigate, guardedAction, blocking }
}
