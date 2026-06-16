/**
 * VibeFlow — Video Background Configuration
 * 
 * ═══════════════════════════════════════════════════════
 *  HOW TO ADD YOUR OWN VIDEO:
 * ═══════════════════════════════════════════════════════
 * 
 *   1. Put your .mp4 file in the /public/videos/ folder
 *   2. Add an entry to the VIDEOS array below
 *   3. That's it! Works locally AND on the deployed website.
 * 
 *   TIP: For web, keep videos under 10MB for smooth loading.
 *        Use Handbrake or similar to compress large files.
 *        720p resolution is plenty for backgrounds.
 * 
 *   EXAMPLE:
 *   {
 *     id: 'my-cool-video',
 *     name: 'My Cool Video',
 *     icon: '🎥',
 *     src: 'my_cool_video.mp4',  // filename in /public/videos/
 *   }
 * ═══════════════════════════════════════════════════════
 */

export interface VideoConfig {
  /** Unique identifier */
  id: string
  /** Display name shown in the picker */
  name: string
  /** Emoji icon for compact view */
  icon: string
  /** Video source — filename in /public/videos/ folder */
  src: string
  /** Optional thumbnail image path (put in /public/thumbnails/) */
  thumbnail?: string
}

/**
 * 🎬 VIDEO BACKGROUNDS
 * 
 * Add your own videos here! Put the .mp4 file in /public/videos/
 * and add a new entry to this array.
 */
export const VIDEOS: VideoConfig[] = [
  {
    id: 'vid1',
    name: 'Sunset Car',
    icon: '🌅',
    src: 'vid1.mp4'
  },
  {
    id: 'vid2',
    name: 'Mad Loop',
    icon: '🔄',
    src: 'vid2.mp4'
  },
  {
    id: 'vid3',
    name: 'Space Car',
    icon: '🚗',
    src: 'vid3.mp4'
  }
]

/**
 * Helper: resolve a video src to a usable path.
 * - Full URLs (https://...) are returned as-is.
 * - Filenames are resolved relative to /videos/ folder.
 */
export function resolveVideoSrc(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  // In Electron: relative path to project videos/ folder
  // In Web (Vite): served from public/videos/ → /videos/
  // Check if running in Electron (file:// protocol) or web (http://)
  if (window.location.protocol === 'file:') {
    // Electron — use relative path from out/renderer/ to videos/
    return `../../videos/${src}`
  }
  // Web — served from public/videos/
  return `/videos/${src}`
}
