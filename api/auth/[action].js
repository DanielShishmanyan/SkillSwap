import { createAuthHttpHandler } from '../../server/auth-http.js'
import { getAuthRuntime } from '../../server/auth-runtime.js'

export default createAuthHttpHandler(getAuthRuntime)
