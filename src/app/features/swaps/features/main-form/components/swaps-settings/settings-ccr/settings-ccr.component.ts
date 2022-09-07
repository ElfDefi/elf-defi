import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup } from '@ngneat/reactive-forms';
import {
  CcrSettingsForm,
  SettingsService
} from '@features/swaps/features/main-form/services/settings-service/settings.service';
import { PromoCode } from '@features/swaps/features/main-form/models/promo-code';
import { TUI_NUMBER_FORMAT } from '@taiga-ui/core';
import { TargetNetworkAddressService } from '@features/swaps/features/cross-chain-routing/components/target-network-address/services/target-network-address.service';

@Component({
  selector: 'app-settings-ccr',
  templateUrl: './settings-ccr.component.html',
  styleUrls: ['./settings-ccr.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: TUI_NUMBER_FORMAT,
      useValue: { decimalSeparator: '.', thousandSeparator: ',' }
    }
  ]
})
export class SettingsCcrComponent implements OnInit {
  public readonly defaultSlippageTolerance: number;

  public crossChainRoutingForm: FormGroup<CcrSettingsForm>;

  public slippageTolerance: number;

  public promoCode: PromoCode | null = null;

  public readonly minimumSlippageTolerance = 3;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly targetNetworkAddressService: TargetNetworkAddressService
  ) {
    this.defaultSlippageTolerance = this.settingsService.defaultCcrSettings.slippageTolerance;
  }

  public ngOnInit(): void {
    this.setForm();
  }

  private setForm(): void {
    const formValue = this.settingsService.crossChainRoutingValue;
    this.crossChainRoutingForm = new FormGroup<CcrSettingsForm>({
      autoSlippageTolerance: new FormControl<boolean>(formValue.autoSlippageTolerance),
      slippageTolerance: new FormControl<number>(formValue.slippageTolerance),
      autoRefresh: new FormControl<boolean>(formValue.autoRefresh),
      promoCode: new FormControl<PromoCode | null>(null),
      showReceiverAddress: new FormControl<boolean>(formValue.showReceiverAddress)
    });
    this.slippageTolerance = formValue.slippageTolerance;
    this.promoCode = formValue.promoCode;
    this.setFormChanges();
  }

  private setFormChanges(): void {
    this.crossChainRoutingForm.valueChanges.subscribe(settings => {
      this.settingsService.crossChainRouting.patchValue({ ...settings });
      console.log('value in form: ', settings.showReceiverAddress);
      console.log('-------------');
      this.targetNetworkAddressService.showReceiverAddressToggle(settings.showReceiverAddress);
    });
    this.settingsService.crossChainRoutingValueChanges.subscribe(settings => {
      this.crossChainRoutingForm.patchValue({ ...settings }, { emitEvent: false });
      this.slippageTolerance = settings.slippageTolerance;
      this.promoCode = settings.promoCode;
    });
  }

  public toggleAutoSlippageTolerance(): void {
    if (!this.crossChainRoutingForm.value.autoSlippageTolerance) {
      this.slippageTolerance = this.defaultSlippageTolerance;
      this.crossChainRoutingForm.patchValue({
        autoSlippageTolerance: true,
        slippageTolerance: this.slippageTolerance
      });
    } else {
      this.crossChainRoutingForm.patchValue({
        autoSlippageTolerance: false
      });
    }
  }

  public onSlippageToleranceChange(slippageTolerance: number): void {
    this.slippageTolerance =
      slippageTolerance < this.minimumSlippageTolerance
        ? this.minimumSlippageTolerance
        : slippageTolerance;
    this.crossChainRoutingForm.patchValue({
      autoSlippageTolerance: false,
      slippageTolerance: this.slippageTolerance
    });
  }

  public onPromoCodeChanges(promoCode: PromoCode | null): void {
    this.crossChainRoutingForm.patchValue({ promoCode });
  }
}
