export const APP_NAME = 'Shotırs'

export const DEFAULT_SCREENSHOT_HOTKEY = 'PrintScreen'
export const DEFAULT_RECORDING_HOTKEY = 'CommandOrControl+Alt+R'
export const DEFAULT_ANNOTATION_HOTKEY = 'CommandOrControl+Shift+D'
export const DEFAULT_OCR_HOTKEY = 'CommandOrControl+Shift+O'

export const MIN_SELECTION_SIZE = 5

export const IPC_CHANNELS = {
  // Screenshot
  SCREENSHOT_START: 'screenshot:start',
  SCREENSHOT_CANCEL: 'screenshot:cancel',
  SCREENSHOT_CAPTURE: 'screenshot:capture',
  SCREENSHOT_SAVE: 'screenshot:save',
  SCREENSHOT_COPY: 'screenshot:copy',

  // Overlay
  OVERLAY_SELECTION_DONE: 'overlay:selection-done',
  OVERLAY_CANCELLED: 'overlay:cancelled',
  OVERLAY_CAPTURED: 'overlay:captured',
  OVERLAY_BACKGROUND: 'overlay:background',
  SCREEN_BOUNDS: 'screen-bounds',

  // Screenshot result (main → renderer)
  SCREENSHOT_RESULT: 'screenshot:result',
  SCREENSHOT_CAPTURED: 'screenshot:captured',

  // Annotation export (renderer → main)
  SCREENSHOT_COPY_FINAL: 'screenshot:copy-final',
  SCREENSHOT_SAVE_FINAL: 'screenshot:save-final',

  // Recording
  RECORDING_GET_SOURCES: 'recording:get-sources',
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_SAVE: 'recording:save',

  // App
  APP_FORCE_MODE: 'app:force-mode',
  APP_TOGGLE_PIN: 'app:toggle-pin',
  APP_CLOSE: 'app:close',
  APP_HIDE: 'app:hide',
  APP_RESIZE: 'app:resize',

  // History
  HISTORY_GET_ALL: 'history:get-all',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_OPEN_FILE: 'history:open-file',
  HISTORY_SHOW_IN_FOLDER: 'history:show-in-folder',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SELECT_DIR: 'settings:select-dir',

  // Upload / Share
  UPLOAD_SCREENSHOT: 'upload:screenshot',
  UPLOAD_FILE: 'upload:file',

  // Annotation overlay (live drawing during recording)
  ANNOTATION_OVERLAY_MODE: 'annotation-overlay:mode',
  ANNOTATION_OVERLAY_TOGGLE: 'annotation-overlay:toggle',
  ANNOTATION_MODE_CHANGED: 'annotation:mode-changed',
  ANNOTATION_STOP_RECORDING: 'annotation:stop-recording',
  ANNOTATION_COMMAND: 'annotation:command',
  ANNOTATION_TOOLBAR_RESIZE: 'annotation:toolbar-resize',

  // Quick recording
  RECORDING_QUICK_START: 'recording:quick-start',

  // Highlighter cursor (during recording)
  HIGHLIGHTER_CURSOR_TOGGLE: 'highlighter-cursor:toggle',
  HIGHLIGHTER_CURSOR_UPDATE: 'highlighter-cursor:update',
  HIGHLIGHTER_CURSOR_POS: 'highlighter-cursor:pos',

  // Recording effects window (click ripple + spotlight)
  EFFECTS_TOGGLE: 'effects:toggle',
  EFFECTS_STATE: 'effects:state',
  EFFECTS_CLICK: 'effects:click',
  EFFECTS_CURSOR_POS: 'effects:cursor-pos',

  // Webcam preview window
  WEBCAM_TOGGLE: 'webcam:toggle',
  WEBCAM_CONFIG: 'webcam:config',
  WEBCAM_SET_BOUNDS: 'webcam:set-bounds',
  WEBCAM_COMMIT_BOUNDS: 'webcam:commit-bounds',
  WEBCAM_GET_BOUNDS: 'webcam:get-bounds',

  // Region recording
  RECORDING_SELECT_REGION: 'recording:select-region',
  RECORDING_REGION_SELECTED: 'recording:region-selected',

  // Recording crash safety
  RECORDING_INIT_TEMP: 'recording:init-temp',
  RECORDING_WRITE_CHUNK: 'recording:write-chunk',
  RECORDING_FINALIZE: 'recording:finalize',
  RECORDING_CHECK_RECOVERY: 'recording:check-recovery',
  RECORDING_RECOVER: 'recording:recover',
  RECORDING_DISCARD_RECOVERY: 'recording:discard-recovery',

  // OCR
  OCR_RECOGNIZE: 'ocr:recognize',
  OCR_CAPTURE_REGION: 'ocr:capture-region',
  OCR_START: 'ocr:start',

  HISTORY_COPY_FILE: 'history:copy-file',

  // Production logger (renderer → main → file)
  LOG_RENDERER: 'log:renderer',
  LOG_SHOW_FOLDER: 'log:show-folder'
} as const
