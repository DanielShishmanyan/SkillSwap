import { createBookingHttp } from '../../server/booking-http.js'
import { getBookingRuntime } from '../../server/booking-runtime.js'

export default createBookingHttp(getBookingRuntime, 'sessions')
