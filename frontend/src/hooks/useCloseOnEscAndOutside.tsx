import React from 'react'

export default function useCloseOnEscAndOutside(ref: React.RefObject<HTMLElement>, onClose?: () => void) {
  React.useEffect(() => {
    if (!onClose) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') onClose()
    }

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const el = ref?.current
      if (!el) return
      const target = (e as MouseEvent).target as Node | null
      if (target && !el.contains(target)) onClose()
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
    }
  }, [ref, onClose])
}
