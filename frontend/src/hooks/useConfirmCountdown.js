import { useEffect, useState } from 'react'

export function useConfirmCountdown(isOpen, seconds = 3) {
  const [countdown, setCountdown] = useState(seconds)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCountdown(seconds)
      setReady(false)
      return undefined
    }

    setCountdown(seconds)
    setReady(false)

    const intervalId = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(intervalId)
          setReady(true)
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isOpen, seconds])

  return { countdown, ready }
}
