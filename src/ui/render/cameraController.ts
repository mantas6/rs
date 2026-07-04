// OSRS-style orbit camera: owns the PerspectiveCamera, its orbit state, and
// all camera-control input listeners (wheel zoom, middle-drag orbit, arrow
// keys, and two-finger touch orbit/pinch). Mouse *commands* (click / context
// menu / hover) stay in GameCanvas.tsx — this only moves the camera.
import * as THREE from 'three'
import {
  CAM_MAX_DIST,
  CAM_MAX_PITCH,
  CAM_MIN_DIST,
  CAM_MIN_PITCH,
  KEY_PITCH_SPEED,
  KEY_YAW_SPEED,
} from './constants'
import { clamp, touchInfo } from './math'

export class CameraController {
  readonly camera: THREE.PerspectiveCamera

  private readonly canvas: HTMLCanvasElement

  private camYaw = Math.PI
  private camPitch = 0.9
  private camDist = 13
  private readonly pressedKeys = new Set<string>()
  private middleDrag: { x: number; y: number } | null = null
  // Two-finger touch orbit/pinch state (centroid + finger spread).
  private touchGesture: { x: number; y: number; dist: number } | null = null

  constructor(canvas: HTMLCanvasElement, aspect: number) {
    this.canvas = canvas
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200)
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.camDist = clamp(this.camDist * (1 + e.deltaY * 0.001), CAM_MIN_DIST, CAM_MAX_DIST)
  }
  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 1) return
    e.preventDefault()
    this.middleDrag = { x: e.clientX, y: e.clientY }
  }
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.middleDrag) return
    this.camYaw -= (e.clientX - this.middleDrag.x) * 0.008
    this.camPitch = clamp(
      this.camPitch + (e.clientY - this.middleDrag.y) * 0.005,
      CAM_MIN_PITCH,
      CAM_MAX_PITCH,
    )
    this.middleDrag = { x: e.clientX, y: e.clientY }
  }
  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 1) this.middleDrag = null
  }
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!e.key.startsWith('Arrow')) return
    const target = e.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    e.preventDefault()
    this.pressedKeys.add(e.key)
  }
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.key)
  }

  // Touch camera fallback: two fingers orbit (centroid drag) and pinch to
  // zoom. Single-finger taps are left to GameCanvas so tap-to-interact works.
  private readonly onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 2) return
    e.preventDefault()
    this.touchGesture = touchInfo(e)
  }
  private readonly onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 2 || !this.touchGesture) return
    e.preventDefault()
    const info = touchInfo(e)
    this.camYaw -= (info.x - this.touchGesture.x) * 0.008
    this.camPitch = clamp(
      this.camPitch + (info.y - this.touchGesture.y) * 0.005,
      CAM_MIN_PITCH,
      CAM_MAX_PITCH,
    )
    if (this.touchGesture.dist > 0 && info.dist > 0) {
      this.camDist = clamp(
        this.camDist * (this.touchGesture.dist / info.dist),
        CAM_MIN_DIST,
        CAM_MAX_DIST,
      )
    }
    this.touchGesture = info
  }
  private readonly onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) this.touchGesture = null
  }

  /** Attach every camera-control listener (canvas + window). */
  attach(): void {
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd)
    this.canvas.addEventListener('touchcancel', this.onTouchEnd)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  /** Detach every listener added in `attach`. */
  detach(): void {
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  /** Match the camera aspect to the container's CSS box. */
  setAspect(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /**
   * Advance arrow-key rotation and reposition the camera to orbit the given
   * interpolated player tile (`px`, `py`). The interpolated position is
   * already smooth, so the camera tracks it directly.
   */
  update(dt: number, px: number, py: number): void {
    if (this.pressedKeys.has('ArrowLeft')) this.camYaw += KEY_YAW_SPEED * dt
    if (this.pressedKeys.has('ArrowRight')) this.camYaw -= KEY_YAW_SPEED * dt
    if (this.pressedKeys.has('ArrowUp')) this.camPitch += KEY_PITCH_SPEED * dt
    if (this.pressedKeys.has('ArrowDown')) this.camPitch -= KEY_PITCH_SPEED * dt
    this.camPitch = clamp(this.camPitch, CAM_MIN_PITCH, CAM_MAX_PITCH)

    const tx = px + 0.5
    const tz = py + 0.5
    const horizontal = this.camDist * Math.cos(this.camPitch)
    this.camera.position.set(
      tx + horizontal * Math.sin(this.camYaw),
      this.camDist * Math.sin(this.camPitch),
      tz + horizontal * Math.cos(this.camYaw),
    )
    this.camera.lookAt(tx, 0.5, tz)
  }
}
