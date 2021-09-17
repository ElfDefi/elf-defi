import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { HttpService } from 'src/app/core/services/http/http.service';
import { map, switchMap } from 'rxjs/operators';
import { TradeVolume } from 'src/app/core/services/backend/volume-api/models/TradeVolume';
import { TradeVolumeRequest } from 'src/app/core/services/backend/volume-api/models/TradeVolumeRequest';
import { BigNumber } from 'bignumber.js';

@Injectable({
  providedIn: 'root'
})
export class VolumeApiService {
  private tradeVolume$: BehaviorSubject<TradeVolume>;

  /**
   * @description Get trading volumes data.
   * @return Trade volumes.
   */
  public get tradingVolume$(): Observable<TradeVolume> {
    return this.tradeVolume$.asObservable();
  }

  constructor(private httpService: HttpService) {
    this.tradeVolume$ = new BehaviorSubject(undefined);
    this.setTradeVolumeInterval();
  }

  /**
   * @description Make request for trade volumes with interval and update data volume.
   * @return Void.
   */
  private setTradeVolumeInterval(): void {
    timer(2000, 1000 * 60 * 60)
      .pipe(switchMap(() => this.fetchVolume()))
      .subscribe(volume => this.tradeVolume$.next(volume));
  }

  /**
   * @description Make request for trade volumes.
   * @return Observable trade volume.
   */
  private fetchVolume(): Observable<TradeVolume> {
    return this.httpService.get('total_values/').pipe(
      map((volume: TradeVolumeRequest) => ({
        instantTrades: new BigNumber(volume.instant_trades_amount),
        bridges: new BigNumber(volume.bridges_amount)
      }))
    );
  }
}
