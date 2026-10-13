import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
export function NotFoundPage(){return <main className="grid min-h-[70vh] place-items-center p-6 text-center"><div><p className="eyebrow">404</p><h1 className="mt-3 text-4xl font-bold">Page not found</h1><p className="mt-2 text-muted">The page you requested does not exist.</p><Link to="/"><Button className="mt-6">Return home</Button></Link></div></main>}
