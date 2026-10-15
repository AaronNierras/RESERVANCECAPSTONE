import { useEffect, useRef, useState } from 'react'

const PHOTOS = Array.from({ length: 20 }, (_, index) => (
  `/login-background/${String(index + 1).padStart(2, '0')}.jpg`
))

const SLIDE_MS = 40000

export default function LoginBackdrop({ onSlideChange }) {
  const indexRef = useRef(0)
  const showARef = useRef(true)
  const [slides, setSlides] = useState({
    a: { src: PHOTOS[0], visible: true, token: 1 },
    b: { src: PHOTOS[1], visible: false, token: 0 },
  })

  useEffect(() => {
    const upcoming = new Image()
    upcoming.src = PHOTOS[1]

    const timer = window.setInterval(() => {
      const nextIndex = (indexRef.current + 1) % PHOTOS.length
      indexRef.current = nextIndex
      const preload = new Image()
      preload.src = PHOTOS[(nextIndex + 1) % PHOTOS.length]
      showARef.current = !showARef.current
      const useA = showARef.current

      onSlideChange?.()
      setSlides((prev) => {
        if (useA) {
          return {
            a: { src: PHOTOS[nextIndex], visible: true, token: prev.a.token + 1 },
            b: { ...prev.b, visible: false },
          }
        }
        return {
          a: { ...prev.a, visible: false },
          b: { src: PHOTOS[nextIndex], visible: true, token: prev.b.token + 1 },
        }
      })
    }, SLIDE_MS)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="login-scene__slides" aria-hidden="true">
      <Slide slide={slides.a} />
      <Slide slide={slides.b} />
    </div>
  )
}

function Slide({ slide }) {
  return (
    <div className={`login-scene__slide${slide.visible ? ' is-visible' : ''}`}>
      {slide.token > 0 && (
        <div
          key={slide.token}
          className="login-scene__photo"
          style={{ backgroundImage: `url("${slide.src}")` }}
        />
      )}
    </div>
  )
}
