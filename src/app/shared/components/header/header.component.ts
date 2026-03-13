import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ProfileDialogComponent } from '../../../features/profile/components/profile-dialog/profile-dialog.component';
import { AuthService } from '../../../features/auth/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltip, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  openProfile(): void {
    this.dialog.open(ProfileDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'profile-dialog-panel',
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
