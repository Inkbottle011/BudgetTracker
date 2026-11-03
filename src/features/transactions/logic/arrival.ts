// Other pages can ask for the import window to be open when you arrive (getting started's "Import a file").
import { createOpenOnArrival } from '../../../shared/openOnArrival'

const importWindow = createOpenOnArrival()
export const openImportOnArrival = importWindow.ask
export const useOpenImportOnArrival = importWindow.useOpen
