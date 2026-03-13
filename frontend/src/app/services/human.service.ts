import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Matches backend VirtualHuman entity. */
export interface Action {
    id: string;
    name: string;
    description: string;
}

export interface VirtualHuman {
    id: string;
    firstName: string;
    lastName: string;
    isPlayerControlled: boolean;
    moneyBalance: number;
    needHunger: number;
    needEnergy: number;
    needSocial: number;
    needFun: number;
    coordinateX: number;
    coordinateY: number;
    currentAction: Action | null;
}

@Injectable({
    providedIn: 'root'
})
export class HumanService {
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:8080/api/humans'; // Backend exact URL

    getHumans(): Observable<VirtualHuman[]> {
        return this.http.get<VirtualHuman[]>(this.apiUrl);
    }
}
