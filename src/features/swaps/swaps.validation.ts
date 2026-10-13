import { z } from 'zod'
export const swapProposalSchema = z.object({
  requesterSkillId: z.string().min(1, 'Select a skill you will teach.'), receiverSkillId: z.string().min(1, 'Select a skill you want to receive.'),
  requesterSessions: z.coerce.number().int().min(1).max(10), receiverSessions: z.coerce.number().int().min(1).max(10),
  requesterDuration: z.coerce.number().refine((value) => [30,45,60,90,120].includes(value), 'Choose a valid duration.'), receiverDuration: z.coerce.number().refine((value) => [30,45,60,90,120].includes(value), 'Choose a valid duration.'),
  deliveryMode: z.enum(['online','in_person','both']), preferredStartDate: z.string(), preferredEndDate: z.string(), message: z.string().max(500),
}).refine((values) => !values.preferredStartDate || !values.preferredEndDate || values.preferredEndDate >= values.preferredStartDate, { path: ['preferredEndDate'], message: 'End date must be after the start date.' })
export type SwapProposalValues = z.infer<typeof swapProposalSchema>
