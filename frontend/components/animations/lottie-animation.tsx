'use client'

import { useEffect, useRef } from 'react'
import Lottie, { type LottieRefCurrentProps } from 'lottie-react'

interface LottieAnimationProps {
  animationData: any
  loop?: boolean
  autoplay?: boolean
  className?: string
  speed?: number
  direction?: 1 | -1
  onComplete?: () => void
  onEnterFrame?: (frame: number) => void
}

export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className,
  speed = 1,
  direction = 1,
  onComplete,
  onEnterFrame
}: LottieAnimationProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(speed)
      lottieRef.current.setDirection(direction)
    }
  }, [speed, direction])

  const handleComplete = () => {
    onComplete?.()
  }

  const handleEnterFrame = (frame: any) => {
    onEnterFrame?.(frame.currentTime)
  }

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      onComplete={handleComplete}
      onEnterFrame={handleEnterFrame}
    />
  )
}

// Pre-built animations for common use cases
export function LoadingAnimation({ className }: { className?: string }) {
  // This would use a loading animation JSON
  const loadingData = {
    v: "5.5.7",
    fr: 60,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Loading",
    ddd: 0,
    assets: [],
    layers: []
  }

  return (
    <LottieAnimation
      animationData={loadingData}
      className={className}
      loop={true}
      autoplay={true}
    />
  )
}

export function SuccessAnimation({ 
  className, 
  onComplete 
}: { 
  className?: string
  onComplete?: () => void 
}) {
  // This would use a success checkmark animation JSON
  const successData = {
    v: "5.5.7",
    fr: 60,
    ip: 0,
    op: 30,
    w: 100,
    h: 100,
    nm: "Success",
    ddd: 0,
    assets: [],
    layers: []
  }

  return (
    <LottieAnimation
      animationData={successData}
      className={className}
      loop={false}
      autoplay={true}
      onComplete={onComplete}
    />
  )
}

export function ErrorAnimation({ className }: { className?: string }) {
  // This would use an error animation JSON
  const errorData = {
    v: "5.5.7",
    fr: 60,
    ip: 0,
    op: 30,
    w: 100,
    h: 100,
    nm: "Error",
    ddd: 0,
    assets: [],
    layers: []
  }

  return (
    <LottieAnimation
      animationData={errorData}
      className={className}
      loop={false}
      autoplay={true}
    />
  )
}
