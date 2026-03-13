export interface ScreenshotData {
  dataUrl: string
  region: {
    x: number
    y: number
    width: number
    height: number
  }
  timestamp: number
}
