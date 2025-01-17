import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SearchQueryService } from '@features/swaps/shared/components/assets-selector/services/search-query-service/search-query.service';
import { AssetsSelectorService } from '@features/swaps/shared/components/assets-selector/services/assets-selector-service/assets-selector.service';
import { map } from 'rxjs/operators';
import { HeaderStore } from '@core/header/services/header.store';
import { TuiSizeS } from '@taiga-ui/core';

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBarComponent {
  @Input() expandableField: boolean = false;

  public isExpanded = false;

  public readonly searchQuery$ = this.searchQueryService.query$;

  public readonly searchBarText$ = this.assetsSelectorService.selectorListType$.pipe(
    map(selectorListType =>
      selectorListType === 'tokens' ? 'modals.tokensListModal.searchPlaceholder' : 'Search name'
    )
  );

  public searchBarSize: TuiSizeS = this.headerStore.isMobile ? 'm' : 's';

  constructor(
    private readonly searchQueryService: SearchQueryService,
    private readonly assetsSelectorService: AssetsSelectorService,
    private readonly headerStore: HeaderStore
  ) {}

  /**
   * Handles input query change.
   * @param model Input string.
   */
  public onQueryChanges(model: string): void {
    this.searchQueryService.query = model;
  }

  public expand(): void {
    this.isExpanded = !this.isExpanded;
  }
}
