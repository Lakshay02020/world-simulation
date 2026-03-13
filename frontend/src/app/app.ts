import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HumanService, VirtualHuman } from './services/human.service';
import { WorldMapComponent } from './components/world-map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, WorldMapComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private readonly humanSvc = inject(HumanService);

  // State
  public humans = signal<VirtualHuman[]>([]);
  public connectionError = signal<string | null>(null);

  private pollingIntervalId: any;

  ngOnInit() {
    this.pollBackend();
    // Poll every 1 second just like the server tick rate
    this.pollingIntervalId = setInterval(() => this.pollBackend(), 1000);
  }

  ngOnDestroy() {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
  }

  private pollBackend() {
    this.humanSvc.getHumans().subscribe({
      next: (data) => {
        this.humans.set(data);
        this.connectionError.set(null);
      },
      error: (err) => {
        console.error('Simulation Backend Error:', err);
        this.connectionError.set('Lost connection to Simulation Engine. Please ensure the Java Spring Boot backend is running on :8080.');
      }
    });
  }

  // Quick stat formatter helper for template
  public formatStat(value: number): string {
    return Math.max(0, Math.min(100, Math.round(value))).toString();
  }

  // Color mapping for bars (100 is good, 0 is bad)
  public getStatBarColor(value: number): string {
    if (value > 60) return '#6bcb77'; // Green
    if (value > 30) return '#ffd93d'; // Yellow
    return '#ff6b6b'; // Red
  }
}
