import { Routes } from '@angular/router';
import {LoginComponent} from './components/login/login.component';
import {AuthCallbackComponent} from './components/auth-callback.component';
import {HomeComponent} from './components/home.component';
import {AuthGuard} from './services/auth.guard';
import {GameRoomComponent} from './components/game-room/game-room.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  {path: 'game/:id', component:GameRoomComponent, canActivate: [AuthGuard]},
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];
