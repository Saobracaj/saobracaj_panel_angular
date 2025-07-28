import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { QuestionsComponent } from './components/questions/questions.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'questions', 
    component: QuestionsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'questions/:id', 
    component: QuestionsComponent, 
    canActivate: [AuthGuard] 
  },
  { path: '**', redirectTo: '/login' }
];
