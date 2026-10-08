import { createContext, useContext, useEffect } from 'react'

/** Lets a form inside a Dialog tell it whether closing would lose what the user changed. */
export const DialogDirtyContext = createContext<((dirty: boolean) => void) | null>(null)

/** Call from inside a Dialog with true while the form holds changes that are not saved. */
export function useDialogDirty(dirty: boolean): void {
  const setDirty = useContext(DialogDirtyContext)
  useEffect(() => {
    setDirty?.(dirty)
    return () => setDirty?.(false)
  }, [dirty, setDirty])
}
