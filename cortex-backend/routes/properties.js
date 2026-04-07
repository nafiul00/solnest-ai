/**
 * routes/properties.js
 * GET /api/properties            — list all properties with occupancy
 * GET /api/calendar/:propertyId  — 30-day booking calendar
 */

import { Router } from 'express'
import { getProperties, getCalendar } from '../lib/hospitable.js'

const router = Router()

// GET /api/properties
router.get('/', async (_req, res) => {
  try {
    const properties = await getProperties()
    res.json({ properties })
  } catch (err) {
    console.error('[properties] GET /:', err.message)
    res.status(500).json({ error: 'Failed to fetch properties', detail: err.message })
  }
})

// GET /api/calendar/:propertyId
router.get('/calendar/:propertyId', async (req, res) => {
  try {
    const days = await getCalendar(req.params.propertyId)
    res.json({ propertyId: req.params.propertyId, days })
  } catch (err) {
    console.error('[properties] GET /calendar/:id:', err.message)
    res.status(500).json({ error: 'Failed to fetch calendar', detail: err.message })
  }
})

export default router
