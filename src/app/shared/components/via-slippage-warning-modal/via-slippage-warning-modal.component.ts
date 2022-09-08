import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { TuiDialogContext } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';

@Component({
  selector: 'polymorpheus-via-slippage-warning-modal',
  templateUrl: './via-slippage-warning-modal.component.html',
  styleUrls: ['./via-slippage-warning-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViaSlippageWarningModalComponent {
  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<boolean>
  ) {}

  public onConfirm(): void {
    this.context.completeWith(null);
  }
}