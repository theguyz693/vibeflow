import React, { useEffect, useRef } from 'react'

export interface HudInfo {
  title: string
  artist: string
  progress: number // 0..1
}

/** Small title / artist / progress readout for the 3D visuals. Updates the DOM directly, no re-renders. */
export function TrackHud({ info }: { info: React.MutableRefObject<HudInfo> }) {
  const titleEl = useRef<HTMLDivElement>(null)
  const artistEl = useRef<HTMLDivElement>(null)
  const barEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (titleEl.current) titleEl.current.textContent = info.current.title
      if (artistEl.current) artistEl.current.textContent = info.current.artist
      if (barEl.current) barEl.current.style.width = `${Math.min(1, Math.max(0, info.current.progress)) * 100}%`
    }, 120)
    return () => window.clearInterval(id)
  }, [info])

  return (
    <div
      style={{
        position: 'absolute',
        left: 28,
        bottom: 26,
        width: 'min(360px, 60vw)',
        color: '#fff',
        pointerEvents: 'none',
        fontFamily: '"Inter Variable", "Helvetica Neue", Arial, sans-serif',
        textShadow: '0 2px 14px rgba(0,0,0,0.6)'
      }}
    >
      <div ref={titleEl} style={{ fontWeight: 800, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
      <div ref={artistEl} style={{ fontWeight: 500, fontSize: 13, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
      <div style={{ height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2, marginTop: 10 }}>
        <div ref={barEl} style={{ height: '100%', width: '0%', background: '#fff', borderRadius: 2 }} />
      </div>
    </div>
  )
}
