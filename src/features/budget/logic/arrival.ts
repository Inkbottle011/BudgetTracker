// Other pages can ask for "Plan with questions" to be open when you arrive (getting started).
import { createOpenOnArrival } from '../../../shared/openOnArrival'

const planGuide = createOpenOnArrival()
export const openPlanGuideOnArrival = planGuide.ask
export const usePlanGuideOnArrival = planGuide.useOpen
