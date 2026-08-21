import { z } from 'zod'

const IsoDateTimeSchema = z.string().datetime({ offset: true })

/** A single [longitude, latitude] waypoint. */
const LonLatTupleSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
])

export const NextStopSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  expectedArrival: IsoDateTimeSchema.optional(),
})

export const LiveVehicleSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['bus', 'tram']),
  lineId: z.string().min(1),
  lineLabel: z.string().min(1),
  destination: z.string(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  bearing: z.number().finite().min(0).max(360).optional(),
  delaySeconds: z.number().finite().optional(),
  status: z.enum(['live', 'estimated', 'scheduled']),
  nextStop: NextStopSchema.optional(),
  recordedAt: IsoDateTimeSchema,
  shapePath: z.array(LonLatTupleSchema).min(2).optional(),
  pathAhead: z.array(LonLatTupleSchema).min(2).optional(),
})

export const VehicleSnapshotSchema = z.object({
  freshness: z.enum(['live', 'stale']),
  recordedAt: IsoDateTimeSchema,
  lastSuccessfulUpdate: IsoDateTimeSchema.optional(),
  vehicles: z.array(LiveVehicleSchema),
})

export type LiveVehicleInput = z.infer<typeof LiveVehicleSchema>
export type VehicleSnapshotInput = z.infer<typeof VehicleSnapshotSchema>
