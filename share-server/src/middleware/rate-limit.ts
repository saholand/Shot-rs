import rateLimit from 'express-rate-limit'

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: { success: false, error: 'Rate limit exceeded. Max 10 uploads per hour' },
  standardHeaders: true,
  legacyHeaders: false
})

export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,
  message: { success: false, error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
})

export const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
})
