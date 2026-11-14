export interface GeoFix {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  timestamp: number
}

export interface Address {
  city?: string
  state?: string
  country?: string
  displayName?: string
  shortName?: string
}

export interface CapturedPhoto {
  /** Original encoded bytes straight from the camera pipeline (JPEG). */
  blob: Blob
  url: string
  width: number
  height: number
  capturedAt: Date
  /** True when the bytes came from ImageCapture.takePhoto (full sensor resolution). */
  fullResolution: boolean
}

export type TemplateId = 'minimal' | 'travel' | 'maps' | 'timestamp' | 'cinematic'
export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center'

export interface OverlayFields {
  place: boolean
  coords: boolean
  date: boolean
  time: boolean
  altitude: boolean
  accuracy: boolean
}

export interface OverlaySettings {
  visible: boolean
  template: TemplateId
  position: OverlayPosition
  fields: OverlayFields
  /** User-editable location title. Empty string = use geocoded name. */
  customTitle: string
  scale: number
}

export type ExportFormat = 'jpg' | 'jpeg' | 'png' | 'webp'
export type ExportMode = 'original' | 'overlay' | 'exif'
