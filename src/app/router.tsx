/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { ProtectedRoute } from '../components/layout/ProtectedRoute'
import { AuthPage } from '../pages/AuthPage'
import { CalendarPage } from '../pages/CalendarPage'
import { DiscoverPage } from '../pages/DiscoverPage'
import { HomePage } from '../pages/HomePage'
import { MatchesPage } from '../pages/MatchesPage'
import { MessagesPage } from '../pages/MessagesPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProfilePage } from '../pages/ProfilePage'
import { PublicProfilePage } from '../pages/PublicProfilePage'
import { SwapsPage } from '../pages/SwapsPage'
import { SwapDetailsPage } from '../pages/SwapDetailsPage'
const Shell=()=> <><Navbar/><Outlet/></>
export const router=createBrowserRouter([{element:<ProtectedRoute/>,children:[{path:'/',element:<Shell/>,children:[{index:true,element:<HomePage/>},{path:'discover',element:<DiscoverPage/>},{path:'matches',element:<MatchesPage/>},{path:'swaps',element:<SwapsPage/>},{path:'swaps/:swapId',element:<SwapDetailsPage/>},{path:'calendar',element:<CalendarPage/>},{path:'messages',element:<MessagesPage/>},{path:'profile',element:<ProfilePage/>},{path:'users/:id',element:<PublicProfilePage/>},{path:'*',element:<NotFoundPage/>}]}]},{path:'/login',element:<AuthPage key="login"/>},{path:'/register',element:<AuthPage key="register" register/>}])
